const express = require('express');
const multer  = require('multer');
const vision = require('@google-cloud/vision');

const jimp = require("jimp");

const upload = multer({ dest: '/tmp/moneybrotherfier' });

const app = express();
const client = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? new vision.ImageAnnotatorClient({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) })
    : new vision.ImageAnnotatorClient({ keyFilename: __dirname + '/moneybrotherfier-gcp.json' });

const IMAGE_MAX_SIZE = 640;

function getAngleBetweenEyes(face) {
  const leftEye = face.landmarks.find(e => e.type === 'LEFT_EYE').position;
  const rightEye = face.landmarks.find(e => e.type === 'RIGHT_EYE').position;
  return Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
}

const add2 = (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y });
const mul = (d, { x, y }) => ({ x: x * d, y: y * d });

function getRotatedYPos({ x, y }, face) {
  return y + Math.abs(Math.tan(getAngleBetweenEyes(face)) * x);
}

function noseboneYPos(face, scale) {
  const eyeCenter = face.landmarks.find(e => e.type === 'MIDPOINT_BETWEEN_EYES').position;
  const noseTip = face.landmarks.find(e => e.type === 'NOSE_TIP').position;
  const nosebone = add2(mul(.5 * scale, eyeCenter), mul(.5 * scale, noseTip));
  return getRotatedYPos(nosebone, face);
}

function mustascheYPos(face, scale) {
  const noseTip = face.landmarks.find(e => e.type === 'NOSE_TIP').position;
  const lip = face.landmarks.find(e => e.type === 'UPPER_LIP').position;
  const mustasche = add2(mul(.5 * scale, noseTip), mul(.5 * scale, lip));
  return getRotatedYPos(mustasche, face);
}

function moneybrotherfy(imageFile, face) {
  const angle = getAngleBetweenEyes(face) * 180 / Math.PI;
  const outFile = `${imageFile}-brother.jpg`;
  return new Promise((resolve, reject) => jimp.read(imageFile, (err, brother) => {
    err ? reject(err) : resolve(brother);
  }))
  .then(image => new Promise((resolve, reject) => {
    let { width, height } = image.bitmap;
    const scale = Math.min(Math.max(width, height) / IMAGE_MAX_SIZE, 1.0);
    width *= scale;
    height *= scale;
    image
      .resize(width, height)
      .rotate(-angle, true)
      .blit(image.clone(),
            0,
            noseboneYPos(face, scale),
            0,
            mustascheYPos(face, scale),
            width,
            height)
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

app.listen(process.env.PORT || 5010);
