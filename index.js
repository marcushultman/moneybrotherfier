const express = require('express');
const multer  = require('multer');
const vision = require('@google-cloud/vision');

const jimp = require("jimp");

const upload = multer({ dest: '/tmp/moneybrotherfier' });

const app = express();
const client = new vision.ImageAnnotatorClient({
  keyFilename: __dirname + '/moneybrotherfier-gcp.json',
});

function getAngleBetweenEyes(face) {
  const leftEye = face.landmarks.find(e => e.type === 'LEFT_EYE').position;
  const rightEye = face.landmarks.find(e => e.type === 'RIGHT_EYE').position;
  return Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI;
}

function distanceToMustasche(face) {
  return face.landmarks.find(e => e.type === 'UPPER_LIP').position.y;
}

function distanceToNosebone(face) {
  const leftEyeY = face.landmarks.find(e => e.type === 'LEFT_EYE').position.y;
  const rightEyeY = face.landmarks.find(e => e.type === 'RIGHT_EYE').position.y;
  return .25 * leftEyeY + .25 * rightEyeY + .5 * distanceToMustasche(face);
}

function moneybrotherfy(imageFile, face) {
  const angle = getAngleBetweenEyes(face);
  const outFile = `${imageFile}-brother.jpg`;
  return new Promise((resolve, reject) => jimp.read(imageFile, (err, brother) => {
    err ? reject(err) : resolve(brother);
  }))
  .then(image => new Promise((resolve, reject) => {
    const { width, height } = image.bitmap;
    image
      .blit(image.clone(), 0, distanceToNosebone(face), 0, distanceToMustasche(face), width, height)
      .rotate(angle, true)
      .autocrop()
      .write(outFile, () => resolve(image));
  }))
  .then(() => outFile);
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

app.use(express.static('src'));

app.listen(5010);
