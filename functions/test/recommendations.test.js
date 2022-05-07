const {expect, assert} = require('chai');
const admin = require("firebase-admin");

const test = require('firebase-functions-test')({
    projectId: 'social-ocean-6d649',
}, 'firebase-service-account.json');

// Import the exported function definitions from our functions/index.js file
const functions = require("../lib/src/index");
const {TEST_USER_ID, TEST_PRODUCT_ID, ADD_RECOMMENDATION_CLOUT_POINTS} = require("../lib/src/constants");

describe("Recommendations:", () => {

    let snapshot;

    before(async () => {
        const userBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();

        const data = {
            userId: userBefore.ref.id,
            externalProductId: productBefore.data().externalId
        };

        await admin.firestore().collection('recommendations').doc('1').set(data);
        snapshot = await admin.firestore().collection('recommendations').doc('1').get();

    })

    it("should update user clout and product counter on create", async () => {
        const wrapped = test.wrap(functions.onRecommendationCreate);

        const userBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const beforeClout = userBefore.data().clout;

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productRecommendationsBefore = productBefore.data().recommendationCount;

        // Call the function
        await wrapped(snapshot);

        const userAfter = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const afterClout = userAfter.data().clout;

        expect(afterClout).to.eql(beforeClout + ADD_RECOMMENDATION_CLOUT_POINTS, "User clout should add recommendation creation points");

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productRecommendationsAfter = productAfter.data().recommendationCount

        expect(productRecommendationsAfter).to.eql(productRecommendationsBefore + 1, "Recommendation creation should increment product recommendation counter")

    })

    it("should update user clout and product counter on delete", async () => {

        await admin.firestore().collection('recommendations').doc('1').delete();

        const wrapped = test.wrap(functions.onRecommendationDelete);

        const userBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const beforeClout = userBefore.data().clout;

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productRecommendationsBefore = productBefore.data().recommendationCount;

        // Call the function
        await wrapped(snapshot);

        const userAfter = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const afterClout = userAfter.data().clout;

        expect(afterClout).to.eql(beforeClout - ADD_RECOMMENDATION_CLOUT_POINTS, "User clout should subtract recommendation clout points on recommendation DELETE");

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productRecommendationsAfter = productAfter.data().recommendationCount

        expect(productRecommendationsAfter).to.eql(productRecommendationsBefore - 1, "Product should decrement recommendation counts")

    })
});