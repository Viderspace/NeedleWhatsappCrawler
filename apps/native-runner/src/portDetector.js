const net = require('net');

/**
 * Find an available port starting from the given port
 * @param {number} startPort - Port to start checking from (default: 3000)
 * @param {number} maxAttempts - Maximum number of ports to check (default: 100)
 * @returns {Promise<number>} Available port number
 */
async function findAvailablePort(startPort = 3000, maxAttempts = 100) {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    function tryPort(port) {
      if (attempts >= maxAttempts) {
        reject(new Error(`No available port found after checking ${maxAttempts} ports starting from ${startPort}`));
        return;
      }

      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(port);
        });
        server.close();
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          attempts++;
          currentPort++;
          tryPort(currentPort);
        } else {
          reject(err);
        }
      });
    }

    tryPort(currentPort);
  });
}

/**
 * Check if a specific port is available
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if port is available
 */
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });

    server.on('error', () => {
      resolve(false);
    });
  });
}

module.exports = {
  findAvailablePort,
  isPortAvailable
};
