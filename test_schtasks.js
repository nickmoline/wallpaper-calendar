const {execSync} = require('child_process');
try {
    const scriptStr = `npx ts-node 'C:\\fake.ts' run -c 'C:\\fake.json'`;
    const psWrapper = `powershell.exe -WindowStyle Hidden -Command \\"${scriptStr}\\"`;
    console.log("Wrapper:", psWrapper);
    execSync(`schtasks /create /tn "TestTask" /tr "${psWrapper}" /sc daily /st 00:00 /f`, {stdio: 'inherit'});
} catch (e) {
    console.error(e);
}
