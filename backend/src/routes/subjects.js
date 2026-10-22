const express = require('express');
const router = express.Router();
const { listSubjects } = require('../data/subjects');

// Ders/konu kataloğu herkese açıktır; frontend kurulum ekranı buradan beslenir.
router.get('/', (req, res) => {
  res.json(listSubjects());
});

module.exports = router;
