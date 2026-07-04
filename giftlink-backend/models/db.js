// db.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

let url = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
let dbInstance = null;
const dbName = 'giftdb';

const fallbackSeedDataPath = path.join(__dirname, '..', 'util', 'import-mongo', 'gifts.json');
let fallbackSeedData = [];

try {
    fallbackSeedData = JSON.parse(fs.readFileSync(fallbackSeedDataPath, 'utf8')).docs || [];
} catch (error) {
    fallbackSeedData = [];
}

const memoryStore = {
    gifts: fallbackSeedData.map((gift, index) => ({ ...gift, _id: gift._id || `${index + 1}` })),
    users: [],
};

function matchesQuery(item, query = {}) {
    return Object.entries(query).every(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            if (value.$regex) {
                const regex = new RegExp(value.$regex, value.$options || '');
                return regex.test(item[key] ?? '');
            }

            if (value.$lte !== undefined) {
                return (item[key] ?? 0) <= value.$lte;
            }
        }

        return item[key] === value;
    });
}

function createCollection(name) {
    const items = name === 'gifts' ? memoryStore.gifts : memoryStore.users;

    return {
        find(query = {}) {
            const filteredItems = items.filter((item) => matchesQuery(item, query));
            return {
                toArray: async () => filteredItems,
            };
        },
        async findOne(query = {}) {
            return items.find((item) => matchesQuery(item, query)) || null;
        },
        async insertOne(document) {
            const created = {
                ...document,
                _id: document._id || document.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            };
            items.push(created);
            return { ops: [created], insertedId: created._id };
        },
        async countDocuments(query = {}) {
            return items.filter((item) => matchesQuery(item, query)).length;
        },
        async insertMany(documents) {
            const createdItems = documents.map((document, index) => ({
                ...document,
                _id: document._id || `${Date.now()}-${index + 1}`,
            }));
            items.push(...createdItems);
            return { insertedCount: createdItems.length };
        },
        async findOneAndUpdate(filter, update, options) {
            const index = items.findIndex((item) => matchesQuery(item, filter));
            if (index === -1) {
                return null;
            }

            const current = items[index];
            const updated = { ...current, ...(update.$set || update) };
            items[index] = updated;
            return options?.returnDocument === 'after' ? updated : current;
        },
    };
}

function createFallbackDb() {
    return {
        collection(name) {
            return createCollection(name);
        },
    };
}

async function connectToDatabase() {
    if (dbInstance) {
        return dbInstance;
    }

    try {
        const client = new MongoClient(url);
        await client.connect();
        dbInstance = client.db(dbName);
        return dbInstance;
    } catch (error) {
        console.warn('MongoDB unavailable, using in-memory fallback store.', error.message);
        dbInstance = createFallbackDb();
        return dbInstance;
    }
}

module.exports = connectToDatabase;
