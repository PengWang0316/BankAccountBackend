const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(cors());
app.use(helmet());


app.get('/api/v1/Accounts', (req, res) => {
  res.json({
    '123adb': {
      accountId: '123adb', balance: 300.23, name: 'Kevin Wang', lastUpdate: new Date('2018/10/01'),
    },
    aaad123: {
      accountId: 'aaad123', balance: 3300.22, name: 'Joe W.', lastUpdate: new Date('2013/12/22'),
    },
  });
});

app.listen(8081, () => console.log('The web server listening on port 8081'));
