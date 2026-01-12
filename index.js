import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import process from 'process';
import http from 'http';

const {
  MONGODB_URI,
  DB_NAME = 'hello',
  NTFY_SERVER = 'https://ntfy.sh',
  NTFY_TOPIC,
  NTFY_TOPIC_ORDERS,
  NTFY_TOPIC_TICKETS,
  NTFY_PRIORITY = '4',
  NTFY_AUTH,
  PORT = '3000',
} = process.env;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}
if (!NTFY_TOPIC && !NTFY_TOPIC_ORDERS && !NTFY_TOPIC_TICKETS) {
  console.error('Missing NTFY_TOPIC (or NTFY_TOPIC_ORDERS/NTFY_TOPIC_TICKETS)');
  process.exit(1);
}

const server = NTFY_SERVER.replace(/\/$/, '');
const topicFor = (topic) => `${server}/${topic}`;

// Start health check HTTP server for Render
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'orders-ntfy-notifier' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

healthServer.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

async function main() {
  const client = new MongoClient(MONGODB_URI, {
    retryWrites: true,
    retryReads: true,
  });
  await client.connect();
  console.log('Connected to MongoDB');
  const db = client.db(DB_NAME);

  const topicOrders = NTFY_TOPIC_ORDERS || NTFY_TOPIC;
  const topicTickets = NTFY_TOPIC_TICKETS || NTFY_TOPIC;

  if (topicOrders) {
    startWatcher(db, 'orders', topicOrders, {
      title: 'CMP New Order',
      tags: 'bell,shopping_cart',
    });
  }
  if (topicTickets) {
    startWatcher(db, 'tickets', topicTickets, {
      title: 'CMP Buy Credit Ticket',
      tags: 'bell,ticket',
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

function startWatcher(db, collectionName, topic, opts) {
  const coll = db.collection(collectionName);
  const pipeline = [{ $match: { operationType: 'insert' } }];
  const changeStream = coll.watch(pipeline, { fullDocument: 'updateLookup' });
  console.log(`Watching for new ${collectionName}...`);

  const topicUrl = topicFor(topic);
  changeStream.on('change', async (change) => {
    try {
      const doc = change.fullDocument || {};
      const id = doc._id ?? '';
      let person = await resolvePerson(db, doc);
      if (!person.name && !person.email) {
        person = extractPerson(doc);
      }
      const bodyText = [
        'Check this new alert on CMP!',
        `👤: ${person.name || 'N/A'}`,
        `📧: ${person.email || 'N/A'}`,
      ].join('\n');
      const headers = {
        Title: opts.title,
        Priority: NTFY_PRIORITY,
        Tags: opts.tags,
        'Content-Type': 'text/plain',
      };
      if (NTFY_AUTH) headers['Authorization'] = NTFY_AUTH;
      const resp = await fetch(topicUrl, {
        method: 'POST',
        headers,
        body: bodyText,
      });
      if (!resp.ok) {
        console.error('ntfy post failed', resp.status, await resp.text());
      } else {
        console.log(`Sent notification for ${collectionName} ${String(id)}`);
      }
    } catch (err) {
      console.error('Error handling change', err);
    }
  });

  changeStream.on('error', (err) => {
    console.error(`Change stream error for ${collectionName}`, err);
    process.exit(1);
  });
}

function extractPerson(doc) {
  // Try common shapes: direct fields or nested user/customer/createdBy objects
  const candidates = [
    { name: doc.username, email: doc.email },
    doc.user,
    doc.createdBy,
    doc.customer,
    doc.owner,
    doc.contact,
  ].filter(Boolean);
  for (const c of candidates) {
    if (typeof c === 'string') {
      return { name: c, email: undefined };
    }
    if (typeof c === 'object') {
      const name = c.name || c.username || c.fullName || c.displayName;
      const email = c.email || c.mail || c.contactEmail;
      if (name || email) return { name, email };
    }
  }
  return { name: undefined, email: undefined };
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function resolvePerson(db, doc) {
  const users = db.collection('users');
  const refs = [doc.user, doc.createdBy, doc.owner];
  for (const r of refs) {
    const oid = toObjectId(r);
    if (!oid) continue;
    try {
      const u = await users.findOne({ _id: oid }, {
        projection: { username: 1, email: 1, name: 1, fullName: 1, displayName: 1 }
      });
      if (u) {
        const name = u.name || u.fullName || u.displayName || u.username;
        const email = u.email;
        if (name || email) return { name, email };
      }
    } catch (_) {
      // ignore lookup errors
    }
  }
  return { name: undefined, email: undefined };
}

function toObjectId(val) {
  if (!val) return null;
  if (val instanceof ObjectId) return val;
  if (typeof val === 'object' && val._id instanceof ObjectId) return val._id;
  if (typeof val === 'string' && ObjectId.isValid(val)) return new ObjectId(val);
  return null;
}
