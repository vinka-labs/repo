//  -*- coding: utf-8 -*-
//  test-db.js ---
//  created: 2017-11-01 19:47:11
//

'use strict';

const Lab = require('lab');
const lab = exports.lab = Lab.script();
const Code = require('code');
const expect = Code.expect;
const sinon = require('sinon');
const db = require('..').db;

const log = {
    info: () => undefined,
    error: () => undefined,
    debug: () => undefined,
};

lab.experiment('DB', () => {
    lab.beforeEach(() => {
        db.internals.reset();
    });

    lab.test('Create without illegal config', async () => {
        try {
            await db.connect({});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/"user" is required/);
        }

        try {
            await db.connect({}, {user: 'sith', pass: 'sith'});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/"db" is required/);
        }

        try {
            await db.connect({}, {user: 'sith', pass: 'sith', db: 'db', vinkaDB: 'vinkaDB', host: 'deathstar'});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/"host" is not allowed/);
        }
    });

    lab.test('Successful connect with create db', async () => {
        const query = sinon.stub();
        const Pool = sinon.stub();

        const pool0 = {
            connect: sinon.stub().rejects(Error('"yavin" does not exist')),
        };

        const pool1 = {
            connect: sinon.stub().resolves({
                query,
                end: sinon.stub(),
            })
        };

        const pool2 = {
            connect: sinon.stub().resolves({
                end: sinon.stub(),
            })
        };

        Pool.onCall(0).returns(pool0);
        Pool.onCall(1).returns(pool1);
        Pool.onCall(2).returns(pool2);

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize, log);
        const orm = await db.connect(models, {user: 'sith', pass: 'sith', db: 'yavin', vinkaDB: 'vinka'});

        expect(orm.Sequelize).to.be.a.function();
        expect(orm.sequelize).to.be.a.function();
        expect(orm.model).to.be.a.function();

        expect(models.init.callCount).to.be.equal(1);
        expect(Pool.callCount).to.be.equal(3);
        expect(Sequelize.callCount).to.be.equal(1);
        expect(Pool.getCall(0).args).to.be.equal([{
            user: 'sith',
            password: 'sith',
            host: undefined,
            port: undefined,
            database: 'yavin',
            max: 1
        }]);
        expect(Pool.getCall(1).args).to.be.equal([{
            user: 'sith',
            password: 'sith',
            host: undefined,
            port: undefined,
            database: 'vinka',
            max: 1
        }]);
        expect(query.callCount).to.be.equal(1);
        expect(query.getCall(0).args).to.be.equal(['CREATE DATABASE "yavin"']);
        expect(Pool.getCall(2).args).to.be.equal([{
            user: 'sith',
            password: 'sith',
            host: undefined,
            port: undefined,
            database: 'yavin',
            max: 1
        }]);
    });

    lab.test('Failed connect with create db 0', async () => {
        const Pool = sinon.stub();

        const pool0 = {
            connect: sinon.stub().rejects(Error('"yavin" does not exist')),
        };

        Pool.onCall(0).returns(pool0);

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize);

        try {
            await db.connect(models, {user: 'sith', pass: 'sith', db: 'yavin'});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/"vinkaDB" must be defined/);
        }

        expect(models.init.callCount).to.be.equal(0);
        expect(Pool.callCount).to.be.equal(1);
        expect(Sequelize.callCount).to.be.equal(0);
    });

    lab.test('Failed connect with create db 1', async () => {
        const Pool = sinon.stub();

        const pool0 = {
            connect: sinon.stub().rejects(Error('"yavin" does not exist')),
        };

        const pool1 = {
            connect: sinon.stub().resolves({
                query: sinon.stub(),
                end: sinon.stub(),
            })
        };

        const pool2 = {
            connect: sinon.stub().rejects(Error('some error')),
        };

        Pool.onCall(0).returns(pool0);
        Pool.onCall(1).returns(pool1);
        Pool.onCall(2).returns(pool2);

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize);
        try {
            await db.connect(models, {user: 'sith', pass: 'sith', db: 'yavin', vinkaDB: 'vinka'});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/some.error/);
        }

        expect(models.init.callCount).to.be.equal(0);
        expect(Pool.callCount).to.be.equal(3);
        expect(Sequelize.callCount).to.be.equal(0);
    });

    lab.test('Failed connect with create db 2', async () => {
        const Pool = sinon.stub();

        const pool0 = {
            connect: sinon.stub().rejects(Error('"yavin" does not exist')),
        };

        const pool1 = {
            connect: sinon.stub().rejects(Error('some error')),
        };

        Pool.onCall(0).returns(pool0);
        Pool.onCall(1).returns(pool1);

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize);
        try {
            await db.connect(models, {user: 'sith', pass: 'sith', db: 'yavin', vinkaDB: 'vinka'});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/some.error/);
        }

        expect(models.init.callCount).to.be.equal(0);
        expect(Pool.callCount).to.be.equal(2);
        expect(Sequelize.callCount).to.be.equal(0);
    });

    lab.test('Failed initial connect for some reason', async () => {
        const Pool = sinon.stub();

        const pool0 = {
            connect: sinon.stub().rejects(Error('some error')),
        };

        Pool.onCall(0).returns(pool0);

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize);
        try {
            await db.connect(models, {user: 'sith', pass: 'sith', db: 'yavin', vinkaDB: 'vinka'});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/some.error/);
        }

        expect(models.init.callCount).to.be.equal(0);
        expect(Pool.callCount).to.be.equal(1);
        expect(Sequelize.callCount).to.be.equal(0);
    });

    lab.test('Failed initial connect for some reason (throw)', async () => {
        const Pool = sinon.stub();

        const pool0 = {
            connect: sinon.stub().throws(Error('some error')),
        };

        Pool.onCall(0).returns(pool0);

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize);
        try {
            await db.connect(models, {user: 'sith', pass: 'sith', db: 'yavin', vinkaDB: 'vinka'});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/some.error/);
        }

        expect(models.init.callCount).to.be.equal(0);
        expect(Pool.callCount).to.be.equal(1);
        expect(Sequelize.callCount).to.be.equal(0);
    });

    lab.test('Failed to create pool', async () => {
        const Pool = sinon.stub();

        Pool.onCall(0).throws(Error('some error'));

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize);
        try {
            await db.connect(models, {user: 'sith', pass: 'sith', db: 'yavin'});
            Code.fail('should throw');
        } catch (e) {
            expect(e.message).to.match(/some.error/);
        }

        expect(models.init.callCount).to.be.equal(0);
        expect(Pool.callCount).to.be.equal(1);
        expect(Sequelize.callCount).to.be.equal(0);
    });

    lab.test('Host and port', async () => {
        const query = sinon.stub();
        const Pool = sinon.stub();

        const pool2 = {
            connect: sinon.stub().resolves({
                end: sinon.stub(),
            })
        };

        Pool.onCall(0).returns(pool2);

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize, log);
        const orm = await db.connect(models, {
            user: 'sith',
            pass: 'sith',
            db: 'broadview',
            options: {host: 'dufferin', port: 6767}
        });

        expect(orm.Sequelize).to.be.a.function();
        expect(orm.sequelize).to.be.a.function();
        expect(orm.model).to.be.a.function();

        expect(models.init.callCount).to.be.equal(1);
        expect(Pool.callCount).to.be.equal(1);
        expect(Pool.getCall(0).args).to.be.equal([{
            user: 'sith',
            password: 'sith',
            host: 'dufferin',
            port: 6767,
            database: 'broadview',
            max: 1
        }]);
        expect(Sequelize.callCount).to.be.equal(1);
        expect(Sequelize.getCall(0).args).to.be.equal(['broadview', 'sith', 'sith', {
            dialect: 'postgres',
            host: 'dufferin',
            logging: false,
            port: 6767,
        }]);
        expect(query.callCount).to.be.equal(0);
    });

    lab.test('SSL', async () => {
        const query = sinon.stub();
        const Pool = sinon.stub();

        const pool2 = {
            connect: sinon.stub().resolves({
                end: sinon.stub(),
            })
        };

        Pool.onCall(0).returns(pool2);

        const Sequelize = sinon.stub();
        const models = {init: sinon.stub()};
        db.inject({Pool}, Sequelize, log);
        const orm = await db.connect(models, {
            user: 'sith',
            pass: 'sith',
            db: 'broadview',
            ssl: true,
            options: {host: 'dufferin', port: 6767}
        });

        expect(orm.Sequelize).to.be.a.function();
        expect(orm.sequelize).to.be.a.function();
        expect(orm.model).to.be.a.function();
        expect(models.init.callCount).to.be.equal(1);
        expect(Pool.callCount).to.be.equal(1);
        expect(Pool.getCall(0).args).to.be.equal([{
            user: 'sith',
            password: 'sith',
            host: 'dufferin',
            port: 6767,
            ssl: 'require',
            database: 'broadview',
            max: 1
        }]);
        expect(Sequelize.callCount).to.be.equal(1);
        expect(Sequelize.getCall(0).args).to.be.equal(['broadview', 'sith', 'sith', {
            dialect: 'postgres',
            dialectOptions: {ssl: true},
            host: 'dufferin',
            logging: false,
            port: 6767,
        }]);
        expect(query.callCount).to.be.equal(0);
    });
});

//
//  test-db.js ends here
