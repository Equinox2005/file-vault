import config from './config';

async function apiCall(path, method = 'GET', body = null, token = '') {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${config.apiUrl}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'API request failed');
  return data;
}

export function getFiles(folder, token) {
  const query = folder ? `?folder=${encodeURIComponent(folder)}` : '';
  return apiCall(`/files${query}`, 'GET', null, token);
}

export function createFileEntry(fileData, token) {
  return apiCall('/files', 'POST', fileData, token);
}

export function deleteFile(itemId, token) {
  return apiCall(`/files/${itemId}`, 'DELETE', null, token);
}

export function getUploadUrl(data, token) {
  return apiCall('/files/upload-url', 'POST', data, token);
}

export function getDownloadUrl(s3Key, token) {
  return apiCall('/files/download-url', 'POST', { s3Key }, token);
}

export function createFolder(name, parentFolder, token) {
  return apiCall('/folders', 'POST', { name, parentFolder }, token);
}

export function shareFile(s3Key, fileName, recipientEmail, hours, token) {
  return apiCall('/share', 'POST', { s3Key, fileName, recipientEmail, hours }, token);
}
