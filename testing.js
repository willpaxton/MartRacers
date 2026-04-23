const { log } = require("console");
const { Builder, By, Key, until } = require("selenium-webdriver");
const https = require("https");
const chrome = require("selenium-webdriver/chrome");

let driver1, driver2, ID;

function getChromeOptions() {
    const options = new chrome.Options();
    
    options.addArguments('--ignore-certificate-errors');
    options.addArguments('--ignore-ssl-errors');

    if (process.env.CI) {
        // Only headless in GitHub Actions
        options.addArguments('--headless');
        options.addArguments('--no-sandbox');
        options.addArguments('--disable-dev-shm-usage');
    }
    return options;
}

async function createLobbyAndId() {
    console.log("Opening Chrome 1");
    driver1 = await new Builder().forBrowser('chrome').setChromeOptions(getChromeOptions()).build();

    console.log("Going to GameSite");
    await driver1.get('https://localhost:3000');

    console.log("Finding CreateButton");
    const createGameButton = await driver1.wait(until.elementLocated(By.id("createGameBtn")), 10000);
    await createGameButton.click();

    console.log("Finding CreateButton2");
    const createButton = await driver1.wait(until.elementLocated(By.id("createGame")), 10000);
    await createButton.click();

    /*console.log("Finding Lobby ID");
    await driver1.wait(until.elementTextMatches(driver1.findElement(By.id("lobbyId"))), 10000);
    console.log("Lobby Id Found");*/

    
    await driver1.manage().setTimeouts({ implicit: 2000 });
    const lobbyText = await driver1.findElement(By.id("lobbyId")).getText();
    //ID = lobbyText.split(" ")[1];
    console.log("Lobby ID:", lobbyText);
    ID = lobbyText;
    return ID;
}

async function joinLobbyWithSecond(ID) {
    console.log("Opening Chrome 2");
    driver2 = await new Builder().forBrowser('chrome').setChromeOptions(getChromeOptions()).build();
    await driver2.get('https://localhost:3000');
    console.log("Finding JoinButton");
    const joinGameButton = await driver2.wait(until.elementLocated(By.id("joinGameBtn")), 10000);
    await joinGameButton.click();
    console.log("Sending Lobby ID to second client");
    await driver2.findElement(By.id("first")).sendKeys(ID[0], Key.RETURN);
    await driver2.findElement(By.id("second")).sendKeys(ID[1], Key.RETURN);
    await driver2.findElement(By.id("third")).sendKeys(ID[2], Key.RETURN);
    await driver2.findElement(By.id("fourth")).sendKeys(ID[3], Key.RETURN);
    await driver2.findElement(By.id("fifth")).sendKeys(ID[4], Key.RETURN);
    await driver2.findElement(By.id("sixth")).sendKeys(ID[5], Key.RETURN);
    await driver2.findElement(By.id("joinGame")).click();
    await driver1.findElement(By.id("startGameBtn")).click();

    // Wait for the 5 second countdown to finish before returning
    await new Promise(resolve => setTimeout(resolve, 5500));
}

async function getPlayer1Upcs(lobbyCode) {
    const https = require("https");
    
    return new Promise((resolve, reject) => {
        const req = https.get(
            `https://127.0.0.1:3000/debug/lobbies`,
            { rejectUnauthorized: false },
            (res) => {
                let data = "";
                res.on("data", chunk => data += chunk);
                res.on("end", () => {
                    try {
                        const json = JSON.parse(data);
                        const lobby = json[lobbyCode];
                        if (!lobby) return reject(new Error(`Lobby ${lobbyCode} not found`));
                        const upcs = lobby.players[0].items.map(item => item.upc);
                        resolve(upcs);
                    } catch (e) {
                        reject(e);
                    }
                });
            }
        );
        req.on("error", reject);
    });
}

async function testInUPCBar(UPCCode, driver) {
    const manualUpcInput = await driver.findElement(By.id("manual-upc"));
    const manualUpcBtn = await driver.findElement(By.id("submit-upc"));
    
    await manualUpcInput.sendKeys(UPCCode);
    await manualUpcBtn.click();
}

async function runAllTests() {
    try {
        await createLobbyAndId();
        await joinLobbyWithSecond(ID);

        // Wait for game to actually start and load on driver1
        await driver1.wait(until.elementLocated(By.id("toggle-manual")), 30000);
        console.log("Game loaded, toggle button found");

        // Fetch UPCs since the game is confirmed started
        const upcs = await getPlayer1Upcs(ID);
        console.log("Player 1 UPCs:", upcs);

        // Toggle the UPC input open
        const manualUpcBtnToggle = await driver1.findElement(By.id("toggle-manual"));
        await manualUpcBtnToggle.click();
        console.log("Toggled UPC input open");

        // Small delay to let the input box animate/render open
        await new Promise(resolve => setTimeout(resolve, 500));

        for (const upc of upcs) {
            console.log("Testing:", upc);
            await testInUPCBar(upc, driver1);
            // Small delay between scans if needed
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log("All Tests Passed!");
    } finally {
        console.log("Closing browsers");
        if (driver1) await driver1.quit();
        if (driver2) await driver2.quit();
    }
}

runAllTests().catch((error) => {
    console.error("Something went wrong:", error);
});