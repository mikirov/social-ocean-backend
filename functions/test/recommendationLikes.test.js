const {expect, assert} = require('chai');
const admin = require("firebase-admin");

const test = require('firebase-functions-test')({
    projectId: 'social-ocean-6d649',
}, 'firebase-service-account.json');

// Import the exported function definitions from our functions/index.js file
const functions = require("../lib/src/index");
const {TEST_USER_ID, TEST_PRODUCT_ID, TEST_POST_ID, TEST_RECOMMENDATION_ID} = require("../lib/src/constants");

describe("Recommendation likes:", () => {

    let snapshot;

    before(async () => {
        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const data = {
            userId: TEST_USER_ID,
            recommendationId: TEST_RECOMMENDATION_ID,
            externalProductId: productBefore.data().externalId
        };

        await admin.firestore().collection('recommendedItemLikes').doc('1').set(data);
        snapshot = await admin.firestore().collection('recommendedItemLikes').doc('1').get();

    })

    it("should update product and post counters on like", async () => {
        const wrapped = test.wrap(functions.onRecommendationLiked);

        const recommendationBefore = await admin.firestore().collection('recommendations').doc(TEST_RECOMMENDATION_ID).get();
        const recommendationRateBefore = recommendationBefore.data().rate;

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productRecommendationLikesBefore = productBefore.data().totalRecommendationLikes;


        // Call the function
        await wrapped(snapshot);

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productRecommendationLikesAfter = productAfter.data().totalRecommendationLikes;

        expect(productRecommendationLikesAfter).to.eql(productRecommendationLikesBefore + 1, "Recommendation like should increment product counter");

        const recommendationAfter = await admin.firestore().collection('recommendations').doc(TEST_RECOMMENDATION_ID).get();
        const recommendationRateAfter = recommendationAfter.data().rate

        expect(recommendationRateAfter).to.eql(recommendationRateBefore + 1, "Recommendation like should increment post rate")

    })

    it("should update product and post counters on unlike", async () => {

        await admin.firestore().collection('recommendedItemLikes').doc('1').delete();

        const wrapped = test.wrap(functions.onRecommendationUnliked);

        const recommendationBefore = await admin.firestore().collection('recommendations').doc(TEST_RECOMMENDATION_ID).get();
        const recommendationRateBefore = recommendationBefore.data().rate;

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productRecommendationLikesBefore = productBefore.data().totalRecommendationLikes;


        // Call the function
        await wrapped(snapshot);

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productRecommendationLikesAfter = productAfter.data().totalRecommendationLikes;

        expect(productRecommendationLikesAfter).to.eql(productRecommendationLikesBefore - 1, "Recommendation unlike should decrement product counter");

        const recommendationAfter = await admin.firestore().collection('recommendations').doc(TEST_RECOMMENDATION_ID).get();
        const recommendationRateAfter = recommendationAfter.data().rate

        expect(recommendationRateAfter).to.eql(recommendationRateBefore - 1, "Recommendation unlike should decrement post rate")

    })
});