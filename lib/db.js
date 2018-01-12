//  -*- coding: utf-8 -*-
//  db.js ---
//  created: 2017-11-01 14:10:25
//

'use strict';

const joi = require('joi');

const internals = {
    Sequelize: null,
    Pool: null,
    log: null,
};

internals.connectDb = async function (config) {
    const options = {
        user: config.user,
        password: config.pass,
        host: config.options.host,
        port: config.options.port,
        database: config.db,
        max: 1,
    };

    if (config.ssl) {
        options.ssl = 'require';
    }

    const pool = new internals.Pool(options);

    const client = await pool.connect();
    return client;
};

/**
 * Connect to default "vinka" database. From there we can create the
 * application database.
 */
internals.connectVinka = async function (config) {
    if (!config.vinkaDB) {
        throw Error('"vinkaDB" must be defined when trying to create application database');
    }

    const client = internals.connectDb(Object.assign({}, config, {db: config.vinkaDB}));
    return client;
};

/**
 * Try application db connection to see if it the db exists.
 */
internals.tryConnectAppDB = async function (config) {
    const client = await internals.connectDb(config);
    await client.end();
};

/**
 * Create application database.
 */
internals.createDb = async function (config) {
    const client = await internals.connectVinka(config);
    await client.query(`CREATE DATABASE "${config.db}"`);
    await client.end();
};

internals.createOrm = function (models, sequelize) {
    return {
        Sequelize() {
            return internals.Sequelize;
        },

        sequelize() {
            return sequelize;
        },

        model(name) {
            return models[name];
        },
    };
};

internals.migrateUp = function (orm, Umzug) {
    const umzug = new Umzug({
        storage: 'sequelize',
        storageOptions: {
            sequelize: orm.sequelize(),
        },
        logging: internals.log.info,
        migrations: {
            path: 'migrations',
            pattern: /\.js$/,
            params: [orm.sequelize().getQueryInterface(), orm.Sequelize()],
        },
    });

    return umzug.up();
};

internals.initSequelize = function (models, config) {
    const options = Object.assign({
        logging: config.logging ? internals.log.debug : false,
        dialect: 'postgres',
    }, config.options);

    if (config.ssl) {
        options.dialectOptions = {ssl: true};
    }

    internals.log.debug(`connecting to database with options ${JSON.stringify(config)}`);
    const sequelize = new internals.Sequelize(config.db, config.user, config.pass, options);

    models = models.init(sequelize);
    const orm = internals.createOrm(models, sequelize);

    internals.log.info(`connected to database ${config.db}`);

    return orm;
};

const configSchema = joi.object({
    user: joi.string().required(),
    pass: joi.string().required(),
    db: joi.string().required(),
    vinkaDB: joi.string(),
    logging: joi.boolean(),
    ssl: joi.boolean(),
    options: joi.object({
        host: joi.string(),
        port: joi.number().integer().min(1),
    }).unknown(true).optional().default({}),
}).unknown(false);

internals.connect = async function (models, config={}) {
    const {error, value} = joi.validate(config, configSchema);

    if (error) {
        throw error;
    }

    config = value;

    try {
        // try to connect application database
        await internals.tryConnectAppDB(config);
        // initialize sequelize
        return internals.initSequelize(models, config);
    } catch (e) {
        if (e.message.match(new RegExp(`"${config.db}" does not exist`))) {
            // application db not found -> create it and retry connection
            await internals.createDb(config);
            return internals.connect(models, config);
        } else {
            throw e;
        }
    }
};

exports.inject = (pg, Sequelize, log=console) => {
    internals.Pool = pg.Pool;
    internals.Sequelize = Sequelize;
    internals.log = log;
};

exports.connect = internals.connect;
exports.migrateUp = internals.migrateUp;

if (process.env.NODE_ENV === 'test') {
    exports.internals = internals;
    exports.internals.reset = () => {
        internals.sequelize = null;
        internals.Pool = null;
        internals.log = null;
    };
}

//
//  db.js ends here
