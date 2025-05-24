import session from "express-session";
import dynamoDbStore from "connect-dynamodb";

function dynamoDbSessionStore(config = {}) {
  const DynamoDbStore = dynamoDbStore({session})
  return new DynamoDbStore(config)
}

export function sessions(config) {
  let sessionStore
  if(config.sessionStoreType === 'memory') {
    sessionStore = undefined
  } else if(config.sessionStoreType === 'dynamodb') {
    const sessionStoreOptions = config.sessionStoreOptions ?? {}
    sessionStore = dynamoDbSessionStore(sessionStoreOptions)
  } else if(config.sessionStoreType) {
    throw Error(`unknown sessionStoreType ${config.sessionStoreType}`)
  } else {
    throw Error('missing sessionStoreType')
  }

  return session({
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite
    },
  })
}
