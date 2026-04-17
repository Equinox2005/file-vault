import json
import boto3
import uuid
import os
from datetime import datetime
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])
s3 = boto3.client('s3')
sns = boto3.client('sns')
BUCKET = os.environ['S3_BUCKET']
SNS_TOPIC = os.environ['SNS_TOPIC_ARN']


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return respond(200, {'message': 'OK'})

    method = event.get('httpMethod', '')
    path = event.get('path', '')

    try:
        user_id = event['requestContext']['authorizer']['claims']['sub']
        user_email = event['requestContext']['authorizer']['claims'].get('email', 'unknown')
    except (KeyError, TypeError):
        return respond(401, {'error': 'Unauthorized'})

    try:
        if path == '/files' and method == 'GET':
            return get_files(user_id, event)
        elif path == '/files' and method == 'POST':
            return create_file_entry(user_id, json.loads(event.get('body', '{}')))
        elif path == '/files/upload-url' and method == 'POST':
            return get_upload_url(user_id, json.loads(event.get('body', '{}')))
        elif path == '/files/download-url' and method == 'POST':
            return get_download_url(user_id, json.loads(event.get('body', '{}')))
        elif path.startswith('/files/') and method == 'DELETE':
            item_id = path.split('/files/')[1]
            return delete_file(user_id, item_id)
        elif path == '/folders' and method == 'POST':
            return create_folder(user_id, json.loads(event.get('body', '{}')))
        elif path == '/share' and method == 'POST':
            return share_file(user_id, user_email, json.loads(event.get('body', '{}')))
        else:
            return respond(404, {'error': 'Not found'})
    except Exception as e:
        print(f"Error: {str(e)}")
        return respond(500, {'error': str(e)})


def get_files(user_id, event):
    params = event.get('queryStringParameters') or {}
    folder = params.get('folder', '')

    response = table.query(
        KeyConditionExpression=Key('userId').eq(user_id)
    )

    items = response.get('Items', [])
    if folder:
        items = [i for i in items if i.get('folder', 'root') == folder]

    for item in items:
        for key in item:
            if isinstance(item[key], (int, float)):
                item[key] = str(item[key])

    return respond(200, {'items': items})


def create_file_entry(user_id, body):
    item_id = body.get('itemId', str(uuid.uuid4()))
    item = {
        'userId': user_id,
        'itemId': item_id,
        'name': body.get('name', 'untitled'),
        'type': 'file',
        'folder': body.get('folder', 'root'),
        'size': body.get('size', 0),
        'contentType': body.get('contentType', 'application/octet-stream'),
        's3Key': body.get('s3Key', f"{user_id}/{item_id}/{body.get('name', 'untitled')}"),
        'createdAt': datetime.utcnow().isoformat()
    }
    table.put_item(Item=item)
    return respond(201, item)


def get_upload_url(user_id, body):
    item_id = body.get('itemId', str(uuid.uuid4()))
    file_name = body.get('name', 'file')
    content_type = body.get('contentType', 'application/octet-stream')
    s3_key = f"{user_id}/{item_id}/{file_name}"

    url = s3.generate_presigned_url('put_object', Params={
        'Bucket': BUCKET,
        'Key': s3_key,
        'ContentType': content_type
    }, ExpiresIn=300)

    return respond(200, {'uploadUrl': url, 's3Key': s3_key, 'itemId': item_id})


def get_download_url(user_id, body):
    s3_key = body.get('s3Key', '')
    if not s3_key.startswith(user_id + '/'):
        return respond(403, {'error': 'Access denied'})

    url = s3.generate_presigned_url('get_object', Params={
        'Bucket': BUCKET,
        'Key': s3_key
    }, ExpiresIn=3600)

    return respond(200, {'downloadUrl': url})


def delete_file(user_id, item_id):
    response = table.get_item(Key={'userId': user_id, 'itemId': item_id})
    item = response.get('Item')

    if item and item.get('type') == 'file' and item.get('s3Key'):
        try:
            s3.delete_object(Bucket=BUCKET, Key=item['s3Key'])
        except:
            pass

    table.delete_item(Key={'userId': user_id, 'itemId': item_id})
    return respond(200, {'message': 'Deleted'})


def create_folder(user_id, body):
    item_id = str(uuid.uuid4())
    item = {
        'userId': user_id,
        'itemId': item_id,
        'name': body.get('name', 'New Folder'),
        'type': 'folder',
        'folder': body.get('parentFolder', 'root'),
        'createdAt': datetime.utcnow().isoformat()
    }
    table.put_item(Item=item)
    return respond(201, item)


def share_file(user_id, user_email, body):
    s3_key = body.get('s3Key', '')
    file_name = body.get('fileName', 'file')
    recipient_email = body.get('recipientEmail', '')
    hours = body.get('hours', 24)

    if not s3_key.startswith(user_id + '/'):
        return respond(403, {'error': 'Access denied'})

    url = s3.generate_presigned_url('get_object', Params={
        'Bucket': BUCKET,
        'Key': s3_key
    }, ExpiresIn=hours * 3600)

    if recipient_email:
        sns.publish(
            TopicArn=SNS_TOPIC,
            Subject=f'File shared with you: {file_name}',
            Message=f'{user_email} shared a file with you.\n\nFile: {file_name}\nDownload link (expires in {hours} hours):\n{url}'
        )

    return respond(200, {'shareUrl': url, 'expiresIn': f'{hours} hours'})


def respond(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
        },
        'body': json.dumps(body, default=str)
    }