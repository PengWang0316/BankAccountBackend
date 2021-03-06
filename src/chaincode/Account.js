/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
const shim = require('fabric-shim');

const ACCOUNT_PREFIX = 'a_';
const TRANSACTION_PREFIX = 't_';
const DEPOSIT_TYPE = 'DEPOSIT';
const WITHDRAW_TYPE = 'WITHDRAW';
const INTEREST_TYPE = 'INTEREST';

const ANNUAL_INTEREST_RATE = 0.02;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function createTransaction(stub, {
  accountId, amount, type, date,
}) { // appends a timestamp plus a 0 - 99 random number for the transaction key
  return stub.putState(`${TRANSACTION_PREFIX}${accountId}_${Date.now()}${Math.floor(Math.random() * 100)}`, Buffer.from(JSON.stringify({
    type, date, amount,
  })));
}

async function parseAccounts(iterator) {
  const results = {};
  while (true) {
    const res = await iterator.next();
    if (res.value && res.value.value.toString()) {
      try {
        const account = JSON.parse(res.value.value.toString('utf8'));
        results[account.accountId] = account;
      } catch (err) {
        const account = res.value.value.toString('utf8');
        results[account.accountId] = account;
      }
    }
    if (res.done) {
      await iterator.close();
      return Buffer.from(JSON.stringify(results));
    }
  }
}

async function parseTransations(iterator) {
  const results = [];
  while (true) {
    const res = await iterator.next();
    if (res.value && res.value.value.toString()) {
      try {
        results.push({ key: res.value.key, ...JSON.parse(res.value.value.toString('utf8')) });
      } catch (err) {
        results.push({ key: res.value.key, value: res.value.value.toString('utf8') });
      }
    }
    if (res.done) {
      await iterator.close();
      return Buffer.from(JSON.stringify(results));
    }
  }
}

function dateDiffInDays(data1, data2) {
  // Discard the time and time-zone information.
  const utc1 = Date.UTC(data1.getFullYear(), data1.getMonth(), data1.getDate());
  const utc2 = Date.UTC(data2.getFullYear(), data2.getMonth(), data2.getDate());
  return Math.floor((utc2 - utc1) / MS_PER_DAY);
}

function calculateInterest(currentBalance, startDate, endDate) {
  return (((currentBalance * 100) * Math.floor(dateDiffInDays(startDate, endDate) / 365 * 100) * (ANNUAL_INTEREST_RATE * 100)) / 1000000).toFixed(2) * 1;
}

const Account = class {
  /**
   * Initialize the state when the chaincode is either instantiated or upgraded
   *
   * @param {*} stub
   */
  async Init(stub) {
    return shim.success();
  }

  /**
   * The Invoke method will call the methods below based on the method name passed by the calling
   * program.
   *
   * @param {*} stub
   */
  async Invoke(stub) {
    const ret = stub.getFunctionAndParameters();

    const method = this[ret.fcn];
    if (!method) {
      throw new Error(`No chaincode function with name: ${ret.fcn} found`);
    }
    try {
      const response = await method(stub, ret.params);
      return shim.success(response);
    } catch (err) {
      return shim.error(err);
    }
  }

  /**
   * Initialize the state. This should be explicitly called if required.
   *
   * @param {*} stub
   * @param {*} args
   */
  async initLedger(stub, args) {}

  // TODO: check the input
  async createAccount(stub, args) {
    const account = JSON.parse(args);
    const key = `${ACCOUNT_PREFIX}${account.accountId}`;
    if (!account.lastUpdate) account.lastUpdate = new Date().toUTCString();


    await stub.putState(key, Buffer.from(JSON.stringify(account)));

    // Create a transaction for this account
    await createTransaction(stub, {
      accountId: account.accountId,
      amount: account.balance,
      type: DEPOSIT_TYPE,
      date: account.lastUpdate,
    });
  }

  async queryAccount(stub, args) {
    return stub.getState(`${ACCOUNT_PREFIX}${JSON.parse(args).accountId}`);
  }

  async queryAccounts(stub, args) {
    const { startAccountId, endAccountId } = JSON.parse(args);
    const iterator = await stub.getStateByRange(`${ACCOUNT_PREFIX}${startAccountId}`, `${ACCOUNT_PREFIX}${endAccountId}`);
    return parseAccounts(iterator);
  }

  async fetchAllAccount(stub) {
    const iterator = await stub.getStateByRange(`${ACCOUNT_PREFIX}0`, `${ACCOUNT_PREFIX}z`);
    return parseAccounts(iterator);
  }

  async fetchTransactions(stub, args) {
    const { accountId } = JSON.parse(args);
    const iterator = await stub.getStateByRange(`${TRANSACTION_PREFIX}${accountId}_0`, `${TRANSACTION_PREFIX}${accountId}_z`);
    return parseTransations(iterator);
  }

  async deposit(stub, args) {
    const { accountId, amount, date } = JSON.parse(args);
    const today = date ? new Date(date) : new Date();
    const dateString = today.toUTCString();
    const account = JSON.parse(await stub.getState(`${ACCOUNT_PREFIX}${accountId}`));

    // Added interest first and than add deposit amount
    const interest = calculateInterest(account.balance, new Date(account.lastUpdate), today);
    account.balance = (account.balance * 100 + amount * 100 + interest * 100) / 100;

    account.lastUpdate = dateString;

    // update the account
    await stub.putState(`${ACCOUNT_PREFIX}${accountId}`, Buffer.from(JSON.stringify(account)));

    // Create a transaction for the interest
    await createTransaction(stub, {
      accountId, amount: interest, type: INTEREST_TYPE, date: dateString,
    });
    // Create a transaction for this deposit
    await createTransaction(stub, {
      accountId, amount, type: DEPOSIT_TYPE, date: dateString,
    });
  }

  async withdraw(stub, args) {
    const { accountId, amount, date } = JSON.parse(args);
    const today = date ? new Date(date) : new Date();
    const dateString = today.toUTCString();
    const account = JSON.parse(await stub.getState(`${ACCOUNT_PREFIX}${accountId}`));

    // Throw an error when the balance less than amount money a user wants to withdraw
    if (account.balance < amount) throw new Error('No sufficient balance.');
    else {
      // Calculate the interest based on old amount and last update date
      const interest = calculateInterest(account.balance, new Date(account.lastUpdate), today);
      account.balance = (account.balance * 100 - amount * 100 + interest * 100) / 100;

      account.lastUpdate = dateString;

      // update the account
      await stub.putState(`${ACCOUNT_PREFIX}${accountId}`, Buffer.from(JSON.stringify(account)));

      // Create a transaction for the interest
      await createTransaction(stub, {
        accountId, amount: interest, type: INTEREST_TYPE, date: dateString,
      });
      // Create a transaction for this withdraw
      await createTransaction(stub, {
        accountId, amount, type: WITHDRAW_TYPE, date: dateString,
      });
    }
  }
};

// Uncomment the line below befor deploy (shim start will affect the local test)
// shim.start(new Account());
module.exports = Account;
