import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import config from './config';

const userPool = new CognitoUserPool({
  UserPoolId: config.cognito.userPoolId,
  ClientId: config.cognito.clientId,
});

export function signUp(email, password) {
  return new Promise((resolve, reject) => {
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
    ];
    userPool.signUp(email, password, attributeList, null, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

export function confirmSignUp(email, code) {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

export function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (result) => resolve(result),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut() {
  const currentUser = userPool.getCurrentUser();
  if (currentUser) currentUser.signOut();
}

export function getCurrentUser() {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) { resolve(null); return; }
    currentUser.getSession((err, session) => {
      if (err || !session.isValid()) { resolve(null); return; }
      resolve({
        user: currentUser,
        token: session.getIdToken().getJwtToken(),
        email: session.getIdToken().payload.email,
      });
    });
  });
}
