import express from "express"

const app = express();

app.get("/", (req, res) => {
    res.status(200).json({
        "yo": "whats up"
    })
})


app.listen(8080, () => {
    console.log("api is running on the http://localhost:8080")
})