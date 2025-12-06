const express = require('express');
const upload = require('../middleware/upload');
const { createTraining, getPublishedTrainings, updateTraining, deleteTraining, getAllTrainings } = require('../controllers/studenttrainigController');
const { updateProgress, getProgress } = require('../controllers/trainingprogressController');
const { protect } = require('../middleware/authMiddleware');


const router = express.Router();



router.put("/progress", protect(["student"]), updateProgress);

router.get("/progress/:trainingId", protect(["student"]), getProgress);


router.post('/', upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 }
]), createTraining);


router.get('/published', getPublishedTrainings);


router.put('/:id', upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "video", maxCount: 1 }
]), updateTraining);


router.get("/", getAllTrainings)


router.delete('/:id', deleteTraining);




module.exports = router;
