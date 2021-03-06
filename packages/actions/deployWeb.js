const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const git = require('simple-git');
const yaml = require('js-yaml');
const common = require('./lib/common');

let command = '';

/**
 * Action to deploy openwhisk elements from a compliant repository
 *  @param {string} gitUrl - github url containing the manifest and elements to deploy
 *  @param {string} manifestPath - (optional) the path to the manifest file, e.g. "openwhisk/src"
 *  @param {object} envData - (optional) some specific details such as cloudant username or cloudant password
 *  @return {object} Promise
 */
function main(params) {
  // Grab optional envData and manifestPath params for wskdeploy
  let {
    envData,
    manifestPath,
    gitUrl
  } = params;

  // confirm gitUrl was provided as a parameter
  if (!gitUrl) {
    return sendError(400, 'Please enter the GitHub repo url in params');
  }

  if(params.__ow_method === "post") {
    return new Promise((resolve, reject) => {
      // if no manifestPath was provided, use current directory
      if (!manifestPath) {
        manifestPath = '.';
      }
      // Grab wsp api host and auth from params, or process.env
      const { wskApiHost, wskAuth } = getWskApiAuth(params);

      // Extract the name of the repo for the tmp directory
      const repoSplit = params.gitUrl.split('/');
      const repoName = repoSplit[repoSplit.length - 1];
      const localDirName = `${__dirname}/../tmp/${repoName}`;
      const blueprintsDirName = `${__dirname}/blueprints/${repoName}`;
      if (repoSplit[2] === 'github.com' && repoSplit[3] === 'ibm-functions' && fs.existsSync(blueprintsDirName)) {
        resolve({
          repoDir: blueprintsDirName,
          manifestPath,
          manifestFileName: 'manifest.yaml',
          wskAuth,
          wskApiHost,
          envData,
        });
      }
      else {
        return git()
        .clone(gitUrl, localDirName, ['--depth', '1'], (err, data) => {
          if (err) {
            reject('There was a problem cloning from github.  Does that github repo exist?  Does it begin with http?');
          }
          resolve({
            repoDir: localDirName,
            manifestPath,
            manifestFileName: 'manifest.yaml',
            wskAuth,
            wskApiHost,
            envData,
          });
        });
      }
    })
    .then((result) => {
      return common.main(result);
    })
    .then((success) => {
      return new Promise((resolve, reject) => {
        resolve({
          statusCode: 200,
          headers: {'Content-Type': 'application/json'},
          body: new Buffer(JSON.stringify({'status': 'success'})).toString('base64')
        });
      });
    })
    .catch(
      (err) => {
        return (sendError(400, err));
      }
    );
  }
}

/**
 * Checks if wsk API host and auth were provided in params, if not, gets them from process.env
 * @param  {[Object]} params    [Params object]
 * @return {[Object]}           [Object containing wskApiHost and wskAuth]
 */
function getWskApiAuth(params) {
  let {
    wskApiHost,
    wskAuth,
  } = params;

  if (!wskApiHost) {
    wskApiHost = process.env.__OW_API_HOST;
  }

  if (!wskAuth) {
    wskAuth = process.env.__OW_API_KEY;
  }

  return {
    wskApiHost,
    wskAuth,
  };
}

function sendError(statusCode, error, message) {
  var params = {error: error};
  if (message) {
      params.message = message;
  }
  return {
      statusCode: statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: new Buffer(JSON.stringify(params)).toString('base64')
  };
}

exports.main = main;
