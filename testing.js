const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

let driver1, driver2, ID;

function getChromeOptions() {
    const options = new chrome.Options();
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
    await driver1.get('http://localhost:3000/test.html');

    console.log("Finding CreateButton");
    const createButton = await driver1.wait(until.elementLocated(By.id("createBtn")), 10000);
    await createButton.click();

    console.log("Finding Lobby ID");
    await driver1.wait(
        until.elementTextMatches(driver1.findElement(By.id("gameInfo")), /.+/),
        10000
    );

    const lobbyText = await driver1.findElement(By.id("gameInfo")).getText();
    ID = lobbyText.split(" ")[1];
    console.log("Lobby ID:", ID);
    return ID;
}

async function joinLobbyWithSecond(ID) {
    console.log("Opening Chrome 2");
    driver2 = await new Builder().forBrowser('chrome').setChromeOptions(getChromeOptions()).build();
    await driver2.get('http://localhost:3000/test.html');
    
    console.log("Sending Lobby ID to second client");
    await driver2.findElement(By.id("joinCode")).sendKeys(ID, Key.RETURN);
    await driver2.findElement(By.id("joinBtn")).click();
}

async function getPlayer1Upcs(lobbyCode) {
    return new Promise((resolve, reject) => {
        require("http").get("http://localhost:3000/debug/lobbies", (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                const json = JSON.parse(data);
                const lobby = json[lobbyCode];
                if (!lobby) return reject(new Error(`Lobby ${lobbyCode} not found`));
                const upcs = lobby.players[0].items.map(item => item.upc);
                resolve(upcs);
            });
        }).on("error", reject);
    });
}

async function testInUPCBar(UPCCode, driver) {
    const manualUpcInput = await driver.findElement(By.id("manualUpcInput"));
    const manualUpcBtn = await driver.findElement(By.id("manualUpcBtn"));
    await manualUpcInput.sendKeys(UPCCode);
    await manualUpcBtn.click();
}

async function runAllTests() {
    try {
        await createLobbyAndId()
        await joinLobbyWithSecond(ID)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const upcs = await getPlayer1Upcs(ID);
        console.log("Player 1 UPCs:", upcs);
        for (const upc of upcs)
        {
            await testInUPCBar(upc, driver1);
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