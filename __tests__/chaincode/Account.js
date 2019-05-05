import { ChaincodeMockStub, Transform } from '@theledger/fabric-mock-stub';
import sinon from 'sinon';

// import { mockDate, resetDateObject } from '../utils/MockDate';
import Account from '../../src/chaincode/Account';
import { fail } from 'assert';
// You always need your chaincode so it knows which chaincode to invoke on

let mockStub;
const DEPOSIT_TYPE = 'DEPOSIT';
const WITHDRAW_TYPE = 'WITHDRAW';
const INTEREST_TYPE = 'INTEREST';

// Mock Date object
let DATE_TO_USE;

describe('Test Account Chaincode', () => {
  beforeEach(() => {
    mockStub = new ChaincodeMockStub('MyMockStub', new Account());
    DATE_TO_USE = sinon.useFakeTimers({ now: 1517644800000 });
  });

  afterAll(() => {
    DATE_TO_USE.restore();
  });

  test('Init without issues', async () => {
    const response = await mockStub.mockInit('tx1', []);
    expect(response.status).toBe(200);
  });

  test('Create and query an account', async () => {
    let response = await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId: '123', balance: 100, name: 'Kevin',
    })]);

    expect(response.status).toBe(200);

    response = await mockStub.mockInvoke('tx1', ['queryAccount', JSON.stringify({ accountId: '123' })]);
    expect(Transform.bufferToObject(response.payload)).toEqual({
      accountId: '123',
      balance: 100,
      name: 'Kevin',
      lastUpdate: new Date().toUTCString(),
    });
  });

  // test.only('createTransaction', async () => {
  //   let response = await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
  //     accountId: '123', balance: 100, name: 'Kevin',
  //   })]);

  //   expect(response.status).toBe(200);

  //   response = await mockStub.mockInvoke('tx1', ['fetchTransactions', JSON.stringify({ accountId: '123' })]);
  //   const { data } = Transform.bufferToObject(response.payload);
  //   expect(data[1]).toEqual({
  //     type: DEPOSIT_TYPE,
  //     amount: 100,
  //     name: 'Kevin',
  //     date: DATE_TO_USE.toUTCString(),
  //   });
  // });

  test('queryAccounts', async () => {
    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId: 'aa_123aaad3', balance: 200, name: 'KevinA',
    })]);
    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId: 'aa_dsf123ef3', balance: 100, name: 'Kevin',
    })]);
    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId: 'bb_dsf123ef3', balance: 100, name: 'Kevin',
    })]);
    const response = await mockStub.mockInvoke('tx1', ['queryAccounts', JSON.stringify({
      startAccountId: 'aa_0',
      endAccountId: 'aa_z',
    })]);

    expect(response.status).toBe(200);
    const payload = Transform.bufferToObject(response.payload);
    expect(Object.keys(payload).length).toBe(2);
    expect(payload.a_aa_123aaad3.balance).toBe(200);
    expect(payload.a_aa_123aaad3.name).toBe('KevinA');
    expect(payload.a_aa_123aaad3.accountId).toBe('aa_123aaad3');
    expect(payload.a_aa_dsf123ef3.balance).toBe(100);
  });

  test('fetchAllAccount', async () => {
    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId: 'aa_123aaad3', balance: 200, name: 'Kevin',
    })]);
    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId: 'aa_dsf123ef3', balance: 100, name: 'Kevin',
    })]);
    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId: 'bb_dsf123ef3', balance: 500, name: 'Kevin',
    })]);
    const response = await mockStub.mockInvoke('tx1', ['fetchAllAccount', '{}']);

    expect(response.status).toBe(200);
    const payload = Transform.bufferToObject(response.payload);
    expect(Object.keys(payload).length).toBe(3);
    expect(payload.a_aa_123aaad3.balance).toBe(200);
    expect(payload.a_aa_dsf123ef3.balance).toBe(100);
    expect(payload.a_bb_dsf123ef3.balance).toBe(500);
  });

  test('deposit', async () => {
    const accountId = '123aaad3dsfs';
    const balance = 200;
    const date1 = new Date().toUTCString();
    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId, balance, name: 'Kevin',
    })]);
    DATE_TO_USE = sinon.useFakeTimers({ now: 1556948895861 }); // Set data to a new value
    const date2 = new Date().toUTCString();

    await mockStub.mockInvoke('tx1', ['deposit', JSON.stringify({
      accountId, amount: 100,
    })]);
    await mockStub.mockInvoke('tx1', ['deposit', JSON.stringify({
      accountId, amount: 50,
    })]);

    const response = await mockStub.mockInvoke('tx1', ['fetchTransactions', JSON.stringify({
      accountId,
    })]);

    expect(response.status).toBe(200);
    const payload = Transform.bufferToObject(response.payload);
    expect(payload.length).toBe(5);
    expect(payload[0].key).not.toBeUndefined();
    expect(payload[0].key).not.toBeNull();
    expect(payload[0].amount).toBe(200);
    expect(payload[0].type).toBe(DEPOSIT_TYPE);
    expect(payload[0].date).toBe(date1);

    expect(payload[1].key).not.toBeUndefined();
    expect(payload[1].key).not.toBeNull();
    expect(payload[1].amount).toBe(4.96);
    expect(payload[1].type).toBe(INTEREST_TYPE);
    expect(payload[1].date).toBe(date2);

    expect(payload[2].key).not.toBeUndefined();
    expect(payload[2].key).not.toBeNull();
    expect(payload[2].amount).toBe(100);
    expect(payload[2].type).toBe(DEPOSIT_TYPE);
    expect(payload[2].date).toBe(date2);

    expect(payload[3].key).not.toBeUndefined();
    expect(payload[3].key).not.toBeNull();
    expect(payload[3].amount).toBe(0);
    expect(payload[3].type).toBe(INTEREST_TYPE);
    expect(payload[3].date).toBe(date2);

    expect(payload[4].key).not.toBeUndefined();
    expect(payload[4].key).not.toBeNull();
    expect(payload[4].amount).toBe(50);
    expect(payload[4].type).toBe(DEPOSIT_TYPE);
    expect(payload[4].date).toBe(date2);

    // Retrieve and compare the newest state
    const newResponse = await mockStub.mockInvoke('tx1', ['queryAccount', JSON.stringify({ accountId: '123aaad3dsfs' })]);
    expect(Transform.bufferToObject(newResponse.payload)).toEqual({
      accountId: '123aaad3dsfs',
      balance: 354.96,
      name: 'Kevin',
      lastUpdate: date2,
    });
  });

  test('withdraw with enough balance', async () => {
    const accountId = 'sdfsdfsd';
    const balance = 200;
    const date = new Date().toUTCString();

    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId, balance, name: 'Kevin',
    })]);

    DATE_TO_USE = sinon.useFakeTimers({ now: 1556948895861 }); // Set data to a new value

    await mockStub.mockInvoke('tx1', ['withdraw', JSON.stringify({
      accountId, amount: 50,
    })]);

    const response = await mockStub.mockInvoke('tx1', ['fetchTransactions', JSON.stringify({
      accountId,
    })]);


    expect(response.status).toBe(200);
    const payload = Transform.bufferToObject(response.payload);
    expect(payload.length).toBe(3);
    expect(payload[0].key).not.toBeUndefined();
    expect(payload[0].key).not.toBeNull();
    expect(payload[0].amount).toBe(200);
    expect(payload[0].type).toBe(DEPOSIT_TYPE);
    expect(payload[0].date).toBe(date);

    const newDate = new Date().toUTCString();
    expect(payload[1].key).not.toBeUndefined();
    expect(payload[1].key).not.toBeNull();
    expect(payload[1].amount).toBe(4.96);
    expect(payload[1].type).toBe(INTEREST_TYPE);
    expect(payload[1].date).toBe(newDate);

    expect(payload[2].key).not.toBeUndefined();
    expect(payload[2].key).not.toBeNull();
    expect(payload[2].type).toBe(WITHDRAW_TYPE);
    expect(payload[2].amount).toBe(50);
    expect(payload[2].date).toBe(newDate);

    // Retrieve and compare the newest state
    const newResponse = await mockStub.mockInvoke('tx1', ['queryAccount', JSON.stringify({ accountId: 'sdfsdfsd' })]);
    expect(Transform.bufferToObject(newResponse.payload)).toEqual({
      accountId: 'sdfsdfsd',
      balance: 154.96,
      name: 'Kevin',
      lastUpdate: newDate,
    });
  });

  test('withdraw with enough balance', async () => {
    const accountId = 'sdfsdfsd1qq';
    const balance = 200;
    const date = new Date().toUTCString();

    await mockStub.mockInvoke('tx1', ['createAccount', JSON.stringify({
      accountId, balance, name: 'Kevin',
    })]);

    DATE_TO_USE = sinon.useFakeTimers({ now: 1556948895861 }); // Set data to a new value

    const result = await mockStub.mockInvoke('tx1', ['withdraw', JSON.stringify({
      accountId, amount: 350,
    })]);

    expect(result.message).toEqual(new Error('No sufficient balance.'));

    const response = await mockStub.mockInvoke('tx1', ['fetchTransactions', JSON.stringify({
      accountId,
    })]);

    expect(response.status).toBe(200);
    const payload = Transform.bufferToObject(response.payload);
    expect(payload.length).toBe(1);
    expect(payload[0].key).not.toBeUndefined();
    expect(payload[0].key).not.toBeNull();
    expect(payload[0].amount).toBe(200);
    expect(payload[0].type).toBe(DEPOSIT_TYPE);
    expect(payload[0].date).toBe(date);
  });

  test('Invock without a function name', async () => {
    try {
      await mockStub.mockInvoke('tx1', []);
      fail('Should not reach here');
    } catch (err) {
      expect(err.message).toBe('No chaincode function with name:  found');
    }
  });
});
