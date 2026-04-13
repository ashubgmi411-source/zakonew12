const fetch = require("node-fetch");

async function test() {
    try {
        const res = await fetch("http://localhost:3000/api/assistant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: [{ role: "user", content: "आज खाने में क्या है" }],
                userProfile: { name: "Test User", email: "test@example.com" },
                action: "chat"
            })
        });
        
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Body:", text);
    } catch(err) {
        console.error(err);
    }
}

test();
