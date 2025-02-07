const axios = require('axios');
const fs = require('fs');
const OpenAI = require('openai');

const config = require('./config.json');

// Extract configuration values
const DESIGNER = config.GRAILED.DESIGNER;
const MONITORING_INTERVAL = config.GRAILED.MONITORING_INTERVAL;
const LOWBALL_PERCENTAGE = config.GRAILED.LOWBALL_PERCENTAGE;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.OPENAI.API_KEY
});

// Initialize auth tokens from config
const authTokens = config.AUTH;

// Store seen listings to avoid duplicate messages
let seenListings = new Set();

// Load previously seen listings if they exist
try {
  const seenListingsData = fs.readFileSync('seen_listings.json');
  seenListings = new Set(JSON.parse(seenListingsData));
} catch (error) {
  console.log('No previous seen listings found, starting fresh');
}

async function fetchListings(page = 0) {
  try {
    const requestData = JSON.stringify({
      query: '',
      page,
      hitsPerPage: 40,
      facetFilters: [[`designers.name:${DESIGNER}`]],
      numericFilters: ['price_i>=0', 'price_i<=1000000'],
      facets: ['badges', 'category_path', 'category_size', 'condition', 'department', 'designers.name', 'location', 'price_i', 'strata']
    });

    const response = await axios({
      url: 'https://mnrwefss2q-dsn.algolia.net/1/indexes/Listing_by_heat_production/query',
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Content-Type': 'application/json',
        'Origin': 'https://www.grailed.com',
        'Referer': 'https://www.grailed.com/',
        'x-algolia-api-key': config.ALGOLIA.API_KEY,
        'x-algolia-application-id': config.ALGOLIA.APP_ID
      },
      data: requestData
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    return null;
  }
}

async function getAllListings() {
  let page = 0;
  let allListings = [];
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching page ${page + 1}...`);
    const result = await fetchListings(page);

    if (!result || !result.hits || result.hits.length === 0) {
      hasMore = false;
      continue;
    }

    allListings = allListings.concat(result.hits);
    
    if (result.hits.length < 40) {
      hasMore = false;
    } else {
      page++;
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return allListings;
}

async function generateLowballMessage(listing) {
  const offerPrice = Math.floor(listing.price * LOWBALL_PERCENTAGE);
  const condition = listing.condition.replace('is_', '').replace('_', ' ');

  try {
    const prompt = `you are a dickhead buyer, create a short message to a seller on Grailed to lowball for the following item:
    Item: ${listing.title}
    Current Price: $${listing.price}
    Condition: ${condition}
    Description: ${listing.description || 'Not provided'}
    Offer Price: $${offerPrice}

    The message should:
     - NOT BE TOO LONG! 
     - IF round the price to the lowest 10 or 100 so instead of 2050 for the jacket it would send 2000
     - BE CREATIVE !!! UR TRYNA SQUEEZE EM
     - never sign off ur messages
     - be a little bit obnoxious,
     - be mean about their item and act like it is worth nothing like they are asking but be creative in doing this 
     - try and bargain them comically like a greasy sleazy pawnshop worker, say some jokes, slightly insult their product.
     - Include the specific offer amount of $${offerPrice}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 150
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating AI message:', error);
    // Fallback to a simple message if AI generation fails
    return `Hi! I'm interested in your ${listing.title}. Would you consider ${offerPrice}? Thanks!`;
  }
}

// Update auth tokens in config file
function saveAuthTokens() {
  const configData = require('./config.json');
  configData.AUTH = authTokens;
  fs.writeFileSync('config.json', JSON.stringify(configData, null, 2));
}

async function updateAuthTokens() {
  try {
    // Visit Grailed homepage to get fresh tokens
    const response = await axios.get('https://www.grailed.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    // Extract CSRF token from response headers or cookies
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      authTokens.cookie = cookies.join('; ');
      const csrfMatch = cookies.find(c => c.includes('csrf_token='));
      if (csrfMatch) {
        authTokens.csrf = csrfMatch.split('csrf_token=')[1].split(';')[0];
      }
    }
  } catch (error) {
    console.error('Error updating auth tokens:', error.message);
    throw error;
  }
}

async function sendMessage(listing, message) {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Ensure we have fresh auth tokens
      if (!authTokens.csrf || retryCount > 0) {
        await updateAuthTokens();
        saveAuthTokens();
      }

      // Add random delay between messages to avoid detection
      const delay = Math.floor(Math.random() * 5000) + 2000; // 2-7 seconds
      await new Promise(resolve => setTimeout(resolve, delay));

      const response = await axios({
        url: 'https://www.grailed.com/api/conversations',
        method: 'POST',
        headers: {
          ...config.GRAILED.API_HEADERS,
          'device-id': authTokens.deviceId,
          'x-csrf-token': authTokens.csrf,
          'cookie': authTokens.cookie,
          'referer': `https://www.grailed.com/listings/${listing.id}`
        },
        data: JSON.stringify({
          body: message,
          listing_id: listing.id,
          type: 'question'
        })
      });

      console.log(`Message sent successfully to listing ${listing.id} (${listing.title})`);
      console.log(`Message: ${message}`);
      console.log('---');
      return true;
    } catch (error) {
      console.error(`Error sending message to listing ${listing.id} (Attempt ${retryCount + 1}/${maxRetries}):`, error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  console.error(`Failed to send message after ${maxRetries} attempts`);
  return false;
}

async function processNewListings(listings, isInitialRun = false) {
  for (const listing of listings) {
    if (!seenListings.has(listing.id)) {
      if (isInitialRun) {
        console.log(`Marking initial listing as seen: ${listing.title} - $${listing.price}`);
        seenListings.add(listing.id);
      } else {
        console.log(`New listing found: ${listing.title} - $${listing.price}`);
        
        const message = await generateLowballMessage(listing);
        const messageSent = await sendMessage(listing, message);
        
        if (messageSent) {
          seenListings.add(listing.id);
        }
      }
    }
  }
  
  // Save updated seen listings
  fs.writeFileSync('seen_listings.json', JSON.stringify(Array.from(seenListings)));
}

// Main execution
async function monitorListings() {
  console.log('Starting listing monitor...');
  
  // Initial run to mark existing listings
  try {
    console.log('Performing initial scan to mark existing listings...');
    const initialListings = await getAllListings();
    await processNewListings(initialListings, true);
    console.log('Initial scan complete. Starting monitoring for new listings...');
  } catch (error) {
    console.error('Error during initial scan:', error);
  }

  while (true) {
    try {
      const listings = await getAllListings();
      await processNewListings(listings);
      console.log(`Monitoring complete. Waiting ${MONITORING_INTERVAL/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, MONITORING_INTERVAL));
    } catch (error) {
      console.error('Error in monitoring loop:', error);
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, MONITORING_INTERVAL));
    }
  }
}

monitorListings();