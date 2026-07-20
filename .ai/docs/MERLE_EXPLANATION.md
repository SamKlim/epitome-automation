# What We're Building — Non-Technical Overview

## The Problem

Right now, when someone completes the Epitome Archetype assessment in SurveyMonkey, you have to:
1. Download the response from SurveyMonkey
2. Manually enter it into Excel or another system
3. Score it (calculate which archetype fits best)
4. Generate a report
5. Email it to the client

This is manual, time-consuming, and error-prone.

---

## The Solution

We're building an **automated pipeline** that does all of this for you.

### How It Works (Simple Version)

```
Client fills out survey in SurveyMonkey
           ↓
Make (automation tool) watches for new responses
           ↓
Make automatically sends the response to our database
           ↓
Database stores the response in a structured way
           ↓
[Future] We can then auto-score it, generate reports, email clients
```

### The Three Pieces

**1. SurveyMonkey (you already have this)**
- Clients fill out the Epitome Archetype assessment here
- 12 questions, 4 statements each, ranked 1-4

**2. Make (automation platform)**
- Watches SurveyMonkey for new responses
- When someone finishes, Make automatically grabs the data
- Transforms it into a clean format (no manual data entry)
- Sends it to our database

**3. Supabase (our database)**
- Stores all survey responses in an organized way
- One response per row: name, email, organization, their 12 rankings
- Later: we can query this to score archetypes, generate reports, etc.

---

## What This Means For You

### Phase 1 (Now): Capture Responses
- Responses flow automatically from SurveyMonkey → Database
- No more manual downloading or Excel entry
- All data is organized and ready to analyze

### Phase 2 (Next): Automated Scoring
- System auto-calculates which archetype they are
- Generates their report PDF
- Sends it automatically (or to you for review first)

### Phase 3 (Future): Analytics
- View trends across all clients
- Export data easily for analysis
- Understand patterns in leadership archetypes

---

## Data Safety

- **Your data stays yours.** All responses are stored in Supabase, which you own.
- **No third parties.** We're not selling or sharing client data.
- **Encrypted.** API tokens and sensitive info are never stored in code — kept secure.
- **Audit trail.** Every response is timestamped, so you can see exactly when it came in.

---

## Technical Setup (What We're Actually Doing)

### Why Make? (It's Free)
We chose **Make** (formerly Zapier) because:
- ✅ Free for most automations
- ✅ No server to maintain
- ✅ Connects SurveyMonkey → Database instantly
- ❌ Doesn't require SurveyMonkey Enterprise plan (for now)

### What's a Webhook?
A webhook is an **automated notification + mailbox system**. Think of it like this:

**The Mailbox:**
- Make gives you a unique mailbox address (the webhook URL)
- Example: `https://hook.us2.make.com/6a2zmnix8t6fpi6f9b3d8l7f6uymc4nk`
- `hook.us2.make.com` = where the mail goes
- `6a2zmnix8t6fpi6f9b3d8l7f6uymc4nk` = your unique mailbox ID (only you have it)

**The Flow:**
1. Someone completes your survey in SurveyMonkey
2. SurveyMonkey sends the response to your webhook address
3. Make receives it in the mailbox
4. Make automatically processes it (cleans up data, sends to database)
5. All happens in seconds, no human needed

**Why Webhooks?**
- ✅ Real-time (responses captured instantly)
- ✅ Automatic (no manual checking or uploading)
- ✅ Secure (your unique URL = only you get your data)

### How Make Authenticates (No API Key Needed!)
When you connect Make to SurveyMonkey:
- **Old way:** Paste an API key (risky, needs Enterprise)
- **New way:** Make asks "Can I access your SurveyMonkey?" → You log in → Done
- Make stores the connection securely
- No API key needed = no Enterprise plan required ✅

### Which Survey Are We Monitoring?
**Selected:** Epitome Archetype Framework 2025
- This is the survey your clients complete
- Make watches for new responses in this survey only
- When someone submits, Make captures it

### Which Responses Do We Store?
Make can trigger on:
- **"Response Completed"** = Someone finished all questions and hit submit ✅ **WE WANT THIS**
- "Response Started" = Someone began but didn't finish ❌ (incomplete, don't store)
- "Response Updated" = Someone edited after submitting ❌ (we only want final answers)

**Our choice:** Only capture **completed responses**. This ensures:
- ✅ Full data (all 12 questions answered)
- ✅ Final answers (no editing confusion)
- ✅ Clean database (no partial/abandoned responses)

---

## Timeline

- **This week:** Set up Make + database, test with real responses
- **Next week:** Test the full flow end-to-end
- **Week 3:** Add automated scoring & reporting (depending on complexity)

---

## Questions This Answers

**"What if someone starts but doesn't finish?"**
Only completed responses are stored. Incomplete ones are flagged.

**"Can I see all the responses in one place?"**
Yes! Once set up, you'll have a database you can query or export to Excel anytime.

**"What if the system breaks?"**
Make and Supabase have uptime guarantees. Plus, responses always stay in SurveyMonkey as a backup.

**"Do I need to do anything?"**
Once we set it up, no. Responses flow automatically. You just review/send them out as usual (or automate that too later).

---

## Important: SurveyMonkey API Access & Costs

### The 90-Day Limitation

SurveyMonkey's free API access is temporary:
- **First 90 days:** Works fine, no problem
- **After 90 days:** You need to either (a) upgrade your plan, or (b) request Enterprise access from SurveyMonkey

### Your Options

**Option 1: Upgrade to SurveyMonkey Enterprise** ✅ Recommended
- Cost: ~$1,000-2,000+/month (custom pricing)
- Includes: Permanent API access + all features
- Best for: Long-term, permanent automation
- Timeline: Contact SurveyMonkey sales for quote

**Option 2: Use the 90-Day Free Trial** (Temporary)
- Cost: $0 for the first 90 days
- Best for: Testing/prototyping first
- Then: Decide if you want to upgrade or pause automation

**Option 3: Build Your Own Backend** (More Control)
- Cost: SurveyMonkey plan ($1000+) + server costs ($10-50/month)
- Best for: Custom integrations, full control
- Complexity: More technical, requires maintenance

### Our Recommendation

**Start with Option 2 (90-day free trial):**
1. Build the automation now using the free API access
2. Get it working and tested over the next 90 days
3. If it's valuable to the business, upgrade to Enterprise
4. If not, you've learned what works without paying

**Then decide:** Once it's proven valuable, either upgrade SurveyMonkey or build a custom backend server.

### Pricing Summary

| Approach | SurveyMonkey | Make/Server | Total/Month |
|----------|--------------|-------------|------------|
| Free trial (90 days) | Free | Free | $0 |
| With Make + Enterprise | $1000+ | $10-25 | $1010+ |
| Custom backend + Enterprise | $1000+ | $20-50 | $1020+ |

**Bottom line:** Test for free first. If it works, invest in Enterprise access.

