const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const http = require('http');
const hfc = require('fabric-client');
const WebSocketServer = require('ws');
const log4js = require('log4js');
// const connection = require('./connection.js');
const query = require('./query.js');

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
const host = 'localhost';
const port = 3000;
const username = '';
const orgName = '';
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
  res.json(message);
});

app.post(`${BASE_VERSION}account`, (req, res) => {
  const { name, balance } = req.body;
  res.json({ accountId: `abcddddd_${Math.floor(Math.random() * 100)}`, name, balance });
});

app.get(`${BASE_VERSION}transactions`, (req, res) => {
  const { id } = req.query;
  res.json([
    {
      key: '1234', type: 'Deposit', amount: 200, date: new Date('2018/02/02'),
    },
    {
      key: '1233', type: 'Interest', amount: 2.13, date: new Date('2018/02/04'),
    },
    {
      key: '1434', type: 'Withdraw', amount: 100, date: new Date('2013/12/02'),
    },
    {
      key: '1254', type: 'Deposit', amount: 20, date: new Date('2014/02/02'),
    },
    {
      key: '1224', type: 'Withdraw', amount: 230, date: new Date('2018/05/02'),
    },
    {
      key: '1214', type: 'Deposit', amount: 2000, date: new Date('2019/02/23'),
    },
    {
      key: '1234a', type: 'Deposit', amount: 200, date: new Date('2018/02/02'),
    },
    {
      key: '1233d', type: 'Interest', amount: 2.13, date: new Date('2018/02/04'),
    },
    {
      key: '1434e', type: 'Withdraw', amount: 100, date: new Date('2013/12/02'),
    },
    {
      key: '1254e', type: 'Deposit', amount: 20, date: new Date('2014/02/02'),
    },
    {
      key: '1224f', type: 'Withdraw', amount: 230, date: new Date('2018/05/02'),
    },
    {
      key: '1214v', type: 'Deposit', amount: 2000, date: new Date('2019/02/23'),
    },
    {
      key: '1234d', type: 'Deposit', amount: 200, date: new Date('2018/02/02'),
    },
    {
      key: '1233dd', type: 'Interest', amount: 2.13, date: new Date('2018/02/04'),
    },
    {
      key: '1434h', type: 'Withdraw', amount: 100, date: new Date('2013/12/02'),
    },
    {
      key: '12543', type: 'Deposit', amount: 20, date: new Date('2014/02/02'),
    },
    {
      key: '12244', type: 'Withdraw', amount: 230, date: new Date('2018/05/02'),
    },
    {
      key: '12145', type: 'Deposit', amount: 2000, date: new Date('2019/02/23'),
    },
  ]);
});

app.put(`${BASE_VERSION}account/deposit`, (req, res) => {
  const { amount, accountId } = req.body;
  console.log(amount, accountId);
  res.end();
});

app.put(`${BASE_VERSION}account/withdraw`, (req, res) => {
  const { amount, accountId } = req.body;
  console.log(amount, accountId);
  res.end();
});
