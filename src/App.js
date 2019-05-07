const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const http = require('http');
const hfc = require('fabric-client');
const WebSocketServer = require('ws');
const log4js = require('log4js');

// These four files below come from the AWS example
const query = require('./query.js');
const connection = require('./connection.js');
const blockListener = require('./blocklistener.js');
const invoke = require('./invoke.js');

log4js.configure({
  appenders: { out: { type: 'stdout' } },
  categories: { default: { appenders: ['out'], level: 'info' } },
});
const logger = log4js.getLogger('BANKACCOUNTAPI');

const app = express();
// support parsing of application/json type post data
app.use(bodyParser.json());
// support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: false }));
app.options('*', cors());
app.use(cors());
app.use(helmet());

// Fabric config
hfc.addConfigFile('config.json');
// const host = 'localhost';
const port = 3000;
let username = '';
let orgName = '';
const channelName = hfc.getConfigSetting('channelName');
const chaincodeName = hfc.getConfigSetting('chaincodeName');
const peers = hfc.getConfigSetting('peers');
// Start a Node server
const server = http.createServer(app).listen(port, () => logger.info(`The web server listening on port ${port}`));

// Start a WebSocket server
const wss = new WebSocketServer.Server({ server });
wss.on('connection', (ws) => {
  logger.info('****************** WEBSOCKET SERVER - received connection ************************');
  ws.on('message', (message) => {
    logger.info('##### Websocket Server received message: %s', message);
  });
  ws.send('something');
});


// Endpoints below
const BASE_VERSION = '/api/v1/';

app.get(`${BASE_VERSION}accounts`, async (req, res) => {
  // res.json({
  //   '123adb': {
  //     accountId: '123adb', balance: 300.23, name: 'Kevin Wang', lastUpdate: new Date('2018/10/01'),
  //   },
  //   aaad123: {
  //     accountId: 'aaad123', balance: 3300.22, name: 'Joe W.', lastUpdate: new Date('2013/12/22'),
  //   },
  // });
  const message = await query.queryChaincode(peers, channelName, chaincodeName, {}, 'fetchAllAccount', username, orgName);
  res.json(message[0]);
});

app.post(`${BASE_VERSION}account`, async (req, res) => {
  const { name, balance, accountId } = req.body;
  await invoke.invokeChaincode(peers, channelName, chaincodeName, { name, balance, accountId }, 'createAccount', username, orgName);
  res.end();
});

app.get(`${BASE_VERSION}transactions`, async (req, res) => {
  const { id } = req.query;
  const message = await query.queryChaincode(peers, channelName, chaincodeName, { accountId: id }, 'fetchTransactions', username, orgName);
  res.json(message);
});

app.put(`${BASE_VERSION}account/deposit`, async (req, res) => {
  const { amount, accountId, date } = req.body;
  await invoke.invokeChaincode(peers, channelName, chaincodeName, { amount, accountId, date }, 'deposit', username, orgName);
  res.end();
});

app.put(`${BASE_VERSION}account/withdraw`, async (req, res) => {
  const { amount, accountId, date } = req.body;
  await invoke.invokeChaincode(peers, channelName, chaincodeName, { amount, accountId, date }, 'withdraw', username, orgName);
  res.end();
});

// Register and enroll user. A user must be registered and enrolled before any queries
// Use it to download the certification from CA
// or transactions can be invoked
app.post('/users', async (req, res) => {
  logger.info('================ POST on Users');
  ({ username, orgName } = req.body);
  logger.info('##### End point : /users');
  logger.info(`##### POST on Users- username : ${username}`);
  logger.info(`##### POST on Users - userorg  : ${orgName}`);
  const response = await connection.getRegisteredUser(username, orgName, true);
  logger.info('##### POST on Users - returned from registering the username %s for organization %s', username, orgName);
  logger.info('##### POST on Users - getRegisteredUser response secret %s', response.secret);
  logger.info('##### POST on Users - getRegisteredUser response secret %s', response.message);
  if (response && typeof response !== 'string') {
    logger.info('##### POST on Users - Successfully registered the username %s for organization %s', username, orgName);
    logger.info('##### POST on Users - getRegisteredUser response %s', response);
    // Now that we have a username & org, we can start the block listener
    await blockListener.startBlockListener(channelName, username, orgName, wss);
    res.json(response);
  } else {
    logger.error('##### POST on Users - Failed to register the username %s for organization %s with::%s', username, orgName, response);
    res.json({ success: false, message: response });
  }
});
