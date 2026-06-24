const { execSync, spawn } = require('child_process');

const PORT = process.env.PORT || 3001;

function getPidsUsingPortWindows(port) {
    try {
        const output = execSync(`netstat -ano | findstr :${port}`, {
            stdio: ['pipe', 'pipe', 'ignore'],
            encoding: 'utf8'
        });

        const pids = new Set();
        output
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .forEach(line => {
                // Expect lines like: TCP 0.0.0.0:3001 ... LISTENING 12345
                const parts = line.split(/\s+/);
                const maybePid = parts[parts.length - 1];
                if (/^\d+$/.test(maybePid) && maybePid !== '0') {
                    pids.add(maybePid);
                }
            });

        return Array.from(pids);
    } catch (err) {
        return [];
    }
}

function killExistingServer() {
    if (process.platform === 'win32') {
        const pids = getPidsUsingPortWindows(PORT);
        if (pids.length === 0) {
            console.log(`No process found on port ${PORT}.`);
            return;
        }

        for (const pid of pids) {
            try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                console.log(`Stopped process ${pid} on port ${PORT}.`);
            } catch (err) {
                console.log(`Could not stop process ${pid} (may already be stopped).`);
            }
        }
        return;
    }

    try {
        execSync(`lsof -ti tcp:${PORT} | xargs kill -9`, { stdio: 'ignore' });
        console.log(`Stopped process on port ${PORT}.`);
    } catch (err) {
        console.log(`No process found on port ${PORT}.`);
    }
}

function startServer() {
    console.log(`Starting server on port ${PORT}...`);
    const child = spawn('node', ['integrated-server.js'], {
        stdio: 'inherit',
        env: process.env
    });

    child.on('exit', code => {
        process.exit(code || 0);
    });
}

killExistingServer();
startServer();
