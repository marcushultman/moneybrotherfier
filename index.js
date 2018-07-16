const express = require('express');
const multer  = require('multer');
const vision = require('@google-cloud/vision');

const jimp = require("jimp");

const upload = multer({ dest: '/tmp/moneybrotherfier' });

const app = express();
const client = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? new vision.ImageAnnotatorClient({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) })
    : new vision.ImageAnnotatorClient({ keyFilename: __dirname + '/moneybrotherfier-gcp.json' });

function getAngleBetweenEyes(face) {
  const leftEye = face.landmarks.find(e => e.type === 'LEFT_EYE').position;
  const rightEye = face.landmarks.find(e => e.type === 'RIGHT_EYE').position;
  return Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) ;
}

function getCenterOfTwoPoints(p1, p2, angle){
  const baseY = .5 * p1.y+ .5 * p2.y;
  const averageX = (p1.x + p1.x) / 2;
  const imageOffset = Math.abs(Math.tan(angle) * averageX );
  return { x: averageX, y: baseY + imageOffset};
}

function distanceToMustasche(image, face) {
  const lip = face.landmarks.find(e => e.type === 'UPPER_LIP').position;
  const lipXLocationRatio = lip.x / image.bitmap.width;
  const angle = getAngleBetweenEyes(face);
  const imageOffset = Math.abs(Math.tan(angle) * image.bitmap.width * lipXLocationRatio);
  return lip.y + imageOffset;
}

function distanceToNosebone(image, face) {
  const eyeCenter = face.landmarks.find(e => e.type === 'MIDPOINT_BETWEEN_EYES').position;
  const noseTip = face.landmarks.find(e => e.type=== 'NOSE_TIP').position;
  const angle = getAngleBetweenEyes(face);
  const {x, y} = getCenterOfTwoPoints(eyeCenter, noseTip, angle);
  return y;
}

function moneybrotherfy(imageFile, face) {
  const angle = getAngleBetweenEyes(face) * 180 / Math.PI;
  const outFile = `${imageFile}-brother.jpg`;
  return new Promise((resolve, reject) => jimp.read(imageFile, (err, brother) => {
    err ? reject(err) : resolve(brother);
  }))
  .then(image => new Promise((resolve, reject) => {
    const { width, height } = image.bitmap;
    image
      .rotate(-angle, true)
      .blit(image.clone(), 0, distanceToNosebone(image, face), 0, distanceToMustasche(image, face), width, height)
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
