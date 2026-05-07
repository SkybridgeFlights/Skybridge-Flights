const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔄 مسار الرد على رسائل المستخدم للبوت
router.post('/ask', async (req, res) => {
  const { message, language = 'en' } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional travel assistant from Shaaban Flights. Reply in language: ${language}`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;