const express = require('express');
const multer  = require('multer');
const vision = require('@google-cloud/vision');

const upload = multer({ dest: '/tmp/moneybrotherfier' });

const app = express();
const client = new vision.ImageAnnotatorClient({
  keyFilename: __dirname + '/moneybrotherfier-gcp.json',
});

function moneybrotherfy(imageFile, face) {
  // todo: moneybrotherfy image
  return Promise.resolve(imageFile);
}

app.post('/transform', upload.single('brother'), (req, res, next) => {
  const filename = req.file.path;
  client.faceDetection({ image: { source: { filename }}})
  .then(results => {
    if (!results.length) {
      throw new Error('no results');
    }
    const faces = results[0].faceAnnotations;
    console.log('Found ' + faces.length + (faces.length === 1 ? ' face' : ' faces'));
    if (!faces.length) {
      throw new Error('no brother');
    }
    return faces[0];
  })
  .then(face => moneybrotherfy(filename, face))
  .then(file => res.sendFile(file))
  .catch(err => next(err));
});

app.listen(5010);
