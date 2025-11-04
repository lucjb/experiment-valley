const puppeteer = require('puppeteer');

async function playGame(page, userName) {
    console.log(`Playing session for ${userName}...`);
    
    try {
        // Step 1: Select an opponent
        console.log(`  Selecting opponent for ${userName}...`);
        await page.waitForSelector('.competitor-card', { timeout: 10000 });
        
        const opponentSelected = await page.evaluate(() => {
            const competitors = document.querySelectorAll('.competitor-card');
            if (competitors.length === 0) return false;
            
            // Click the first competitor
            competitors[0].click();
            return true;
        });
        
        if (!opponentSelected) {
            console.log(`  No opponents found, skipping session for ${userName}`);
            return;
        }
        
        // Wait a bit for opponent selection to register
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 2: Set up dialog handler before clicking start
        console.log(`  Setting up dialog handler for: ${userName}...`);
        
        // Remove any existing dialog handlers first
        page.removeAllListeners('dialog');
        
        page.on('dialog', async dialog => {
            console.log(`  Dialog appeared: ${dialog.type()}`);
            if (dialog.type() === 'prompt') {
                console.log(`  Accepting prompt with name: ${userName}`);
                await dialog.accept(userName);
            } else {
                console.log(`  Accepting dialog: ${dialog.message()}`);
                await dialog.accept();
            }
        });
        
        // Step 3: Click start button
        console.log(`  Clicking start button for ${userName}...`);
        await page.waitForSelector('#start-btn:not([disabled])', { timeout: 10000 });
        await page.evaluate(() => {
            const startBtn = document.getElementById('start-btn');
            if (startBtn && !startBtn.disabled) {
                startBtn.click();
            }
        });
        
        // Step 4: Wait for challenge to load
        console.log(`  Waiting for challenge to load...`);
        await page.waitForSelector('#challenge-container', { timeout: 15000 });
        
        // Step 5: Play 3 rounds
        for (let round = 1; round <= 3; round++) {
            console.log(`  Playing round ${round}...`);
            
            // Play 3 experiments per round
            for (let experiment = 1; experiment <= 3; experiment++) {
                console.log(`    Playing experiment ${experiment}...`);
                
                // Wait for decision buttons to be available
                await page.waitForSelector('.decision-btn:not([disabled])', { timeout: 10000 });
                
                // Make all 3 required decisions (trust, decision, follow_up)
                console.log(`    Making all 3 decisions...`);
                await page.evaluate(() => {
                    // Make trust decision
                    const trustButtons = document.querySelectorAll('.decision-btn[name="trust"]:not([disabled])');
                    if (trustButtons.length > 0) {
                        const randomTrust = Math.floor(Math.random() * trustButtons.length);
                        trustButtons[randomTrust].click();
                    }
                    
                    // Make decision
                    const decisionButtons = document.querySelectorAll('.decision-btn[name="decision"]:not([disabled])');
                    if (decisionButtons.length > 0) {
                        const randomDecision = Math.floor(Math.random() * decisionButtons.length);
                        decisionButtons[randomDecision].click();
                    }
                    
                    // Make follow_up decision
                    const followUpButtons = document.querySelectorAll('.decision-btn[name="follow_up"]:not([disabled])');
                    if (followUpButtons.length > 0) {
                        const randomFollowUp = Math.floor(Math.random() * followUpButtons.length);
                        followUpButtons[randomFollowUp].click();
                    }
                });
                
                // Wait a bit for all selections to register
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Submit decision - use the working alternative approach
                console.log(`    Submitting decision...`);
                await page.evaluate(() => {
                    const submitBtns = document.querySelectorAll('button[type="submit"], #submit-decision');
                    for (const btn of submitBtns) {
                        if (!btn.disabled) {
                            btn.click();
                            break;
                        }
                    }
                    
                    // If still no luck, try any button that might be a submit button
                    const allButtons = document.querySelectorAll('button');
                    for (const btn of allButtons) {
                        if (!btn.disabled && (btn.textContent.includes('Submit') || btn.textContent.includes('Submit Decision'))) {
                            btn.click();
                            break;
                        }
                    }
                });
                
                // Wait for feedback modal to appear
                console.log(`    Waiting for feedback...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Click the Next button in the feedback modal
                console.log(`    Clicking Next button...`);
                try {
                    // Try to find and click the next button
                    await page.evaluate(() => {
                        // Look for the next button in the feedback modal
                        const nextButtons = document.querySelectorAll('button');
                        for (const btn of nextButtons) {
                            if (!btn.disabled && (btn.textContent.includes('Next') || btn.textContent.includes('Continue') || btn.id.includes('next'))) {
                                console.log('Found next button:', btn.textContent);
                                btn.click();
                                return true;
                            }
                        }
                        return false;
                    });
                } catch (error) {
                    console.log(`    Next button not found, trying alternative approach...`);
                    // Try pressing Enter key as fallback
                    await page.keyboard.press('Enter');
                }
                
                // Wait for next challenge to load
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`  Session completed for ${userName}`);
        
    } catch (error) {
        console.log(`  Error in session for ${userName}:`, error.message);
    }
}

async function main() {
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    
    const page = await browser.newPage();
    
    // Clear storage for each session
    await page.evaluateOnNewDocument(() => {
        localStorage.clear();
        sessionStorage.clear();
    });
    
    // Navigate to the game
    await page.goto('file:///Users/lucasbernardi/ab-testing-gym/index.html');
    
    console.log('Waiting for page to load...');
    await page.waitForSelector('#start-btn');
    console.log('Page loaded, found start button');
    
    // List of test users
    const testUsers = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    
    // Play sessions for each user
    for (const userName of testUsers) {
        try {
            await playGame(page, userName);
            
            // Wait a bit between sessions
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Refresh the page for next user
            await page.reload();
            await page.waitForSelector('#start-btn');
            
        } catch (error) {
            console.log(`Failed to play session for ${userName}:`, error.message);
        }
    }
    
    console.log('All sessions completed!');
    await browser.close();
}

main().catch(console.error);