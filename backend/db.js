var mysql = require('mysql');

var pool;

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            connectionLimit : 10,
            host            : 'localhost',
            user            : 'myfamily',
            password        : 'myfamily',
            database        : 'myfamily'
        });
    }
    return pool;
}

/**
 * Creates and returns a new connection from the connection pool as a promise.
 * 
 * @export
 * @returns {Promise<IConnection>}
 */
 function connection() {
    return new Promise((resolve, reject) => {
        getPool().getConnection((err, connection) => {
            if (err) { console.info(err); reject(err); }
            else resolve(connection);
        });
    });
}

/**
 * Performs a statement on the given connection and returns its result
 * as a promise. The connection is kept open.
 * 
 * @export
 * @param {IConnection} connection
 * @param {string} an SQL statement string
 * @param {any[]} [params=[]] query parameters
 * @returns {Promise<any>}
 */
function query(connection, stmt, params = []) {
    return new Promise((resolve, reject) => {
        connection.query(stmt, params, (err,res) => {
            if (err) { console.info(err); reject(err); }
            else resolve(res);
        })
    });
}

/**
 * Performs a single DB statement, internally fetching a new connection and releasing it afterwards.
 * The result is returned as a promise.
 * 
 * @export
 * @param {string} stmt an SQL statement string
 * @param {any[]} [params=[]] query parameters
 * @returns {Promise<any>}
 */
function querySingle(stmt, params = []) {
    return connection().then(connection => query(connection, stmt, params).then(res => {
        connection.release();
        return res;
    }));
}

module.exports.connection = connection;
module.exports.query = query;
module.exports.querySingle = querySingle;
