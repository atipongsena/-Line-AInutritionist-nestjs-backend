// MongoDB Initialization Script for AI Nutritionist Development

// Switch to the ai_nutritionist database
db = db.getSiblingDB('ai_nutritionist')

// Create collections with initial indexes
db.createCollection('users')
db.createCollection('foodlogs')
db.createCollection('temporaryimagelogs')
db.createCollection('conversationhistories')

// Create indexes for better performance
db.users.createIndex({ lineUserId: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { sparse: true })

db.foodlogs.createIndex({ userId: 1 })
db.foodlogs.createIndex({ logDate: 1 })
db.foodlogs.createIndex({ userId: 1, logDate: 1 })

db.temporaryimagelogs.createIndex({ userId: 1 })
db.temporaryimagelogs.createIndex({ timestamp: 1 })

db.conversationhistories.createIndex({ userId: 1 })
db.conversationhistories.createIndex({ timestamp: 1 })

// Create development user (optional)
db.createUser({
  user: 'ai_nutritionist_dev',
  pwd: 'dev_password123',
  roles: [
    {
      role: 'readWrite',
      db: 'ai_nutritionist',
    },
  ],
})

print('✅ AI Nutritionist database initialized successfully!')
print(
  '📊 Collections created: users, foodlogs, temporaryimagelogs, conversationhistories',
)
print('🔍 Indexes created for optimal performance')
print('👤 Development user created: ai_nutritionist_dev')
