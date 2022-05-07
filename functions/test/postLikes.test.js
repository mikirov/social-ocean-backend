const {expect, assert} = require('chai');
const admin = require("firebase-admin");

const test = require('firebase-functions-test')({
    projectId: 'social-ocean-6d649',
}, 'firebase-service-account.json');

// Import the exported function definitions from our functions/index.js file
const functions = require("../lib/src/index");
const {TEST_USER_ID, TEST_PRODUCT_ID, TEST_POST_ID} = require("../lib/src/constants");

describe("Post likes:", () => {

    let snapshot;

    before(async () => {
        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const data = {
            userId: TEST_USER_ID,
            postId: TEST_POST_ID,
            externalProductId: productBefore.data().externalId
        };

        await admin.firestore().collection('postedItemLikes').doc('1').set(data);
        snapshot = await admin.firestore().collection('postedItemLikes').doc('1').get();

    })

    it("should update product and post counters on like", async () => {
        const wrapped = test.wrap(functions.onPostLiked);

        const postBefore = await admin.firestore().collection('posts').doc(TEST_POST_ID).get();
        const postRateBefore = postBefore.data().rate;

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productPostLikesBefore = productBefore.data().totalPostLikes;


        // Call the function
        await wrapped(snapshot);

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productPostLikesAfter = productAfter.data().totalPostLikes;

        expect(productPostLikesAfter).to.eql(productPostLikesBefore + 1, "Post like should increment product counter");

        const postAfter = await admin.firestore().collection('posts').doc(TEST_POST_ID).get();
        const postRateAfter = postAfter.data().rate

        expect(postRateAfter).to.eql(postRateBefore + 1, "Post like should increment post rate")

    })

    it("should update product and post counters on unlike", async () => {

        await admin.firestore().collection('postedItemLikes').doc('1').delete();

        const wrapped = test.wrap(functions.onPostUnliked);

        const postBefore = await admin.firestore().collection('posts').doc(TEST_POST_ID).get();
        const postRateBefore = postBefore.data().rate;

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productPostLikesBefore = productBefore.data().totalPostLikes;

        // Call the function
        await wrapped(snapshot);

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productPostLikesAfter = productAfter.data().totalPostLikes;

        expect(productPostLikesAfter).to.eql(productPostLikesBefore - 1, "Post unlike should decrement product counter");

        const postAfter = await admin.firestore().collection('posts').doc(TEST_POST_ID).get();
        const postRateAfter = postAfter.data().rate

        expect(postRateAfter).to.eql(postRateBefore - 1, "Post unlike should decrement post rate")
    })
});