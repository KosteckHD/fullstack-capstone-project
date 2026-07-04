require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectToDatabase = require('../../models/db');

const filename = path.join(__dirname, 'gifts.json');
const data = JSON.parse(fs.readFileSync(filename, 'utf8')).docs;

async function loadData() {
    try {
        const db = await connectToDatabase();
        const collection = db.collection('gifts');
        const documents = await collection.find({}).toArray();

        if (documents.length === 0) {
            const insertResult = await collection.insertMany(data);
            console.log('Inserted documents:', insertResult.insertedCount);
        } else {
            console.log('Gifts already exists in DB');
        }
    } catch (err) {
        console.warn('Skipping gift import seed because no database is available.', err.message);
    }
}

loadData();

module.exports = {
    loadData,
};
