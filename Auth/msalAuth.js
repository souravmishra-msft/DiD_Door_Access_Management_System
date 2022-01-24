const msal = require('@azure/msal-node');
const authConfig = require('../config/config.json');

/** MSAL Config */
const msalConfig = {
  auth: {
      clientId: authConfig.azClientId,
      authority: `https://login.microsoftonline.com/${authConfig.azTenantId}`,
      clientSecret: authConfig.azClientSecret,
  },
  system: {
      loggerOptions: {
          loggerCallback(loglevel, message, containsPii) {
              console.log(message);
          },
          piiLoggingEnabled: false,
          logLevel: msal.LogLevel.Verbose,
      }
  }
};

const cca = new msal.ConfidentialClientApplication(msalConfig);
const msalClientCredentialRequest = {
  scopes: ["bbb94529-53a3-4be5-a069-7eaf2712b826/.default"],
  skipCache: false, 
};


module.exports = { cca, msalClientCredentialRequest };