import express from "express"
import { prisma } from "./db/client";


const app = express();
app.use(express.json())

app.get("/", (req, res) => {
    res.status(200).json({
        "yo": "whats up"
    })
})

app.post("/user", async (req, res) => {
    const { username, password } = req.body

    const user = await prisma.user.create({
        data: {
            username,
            password
        }
    })

    res.status(200).json(user)
})

app.listen(8080, () => {
    console.log("api is running on the http://localhost:8080")
})