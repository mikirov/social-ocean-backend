const {expect, assert} = require('chai');
const admin = require("firebase-admin");

const test = require('firebase-functions-test')({
    projectId: 'social-ocean-6d649',
}, 'firebase-service-account.json');

// Import the exported function definitions from our functions/index.js file
const functions = require("../lib/src/index");
const {TEST_USER_ID, TEST_PRODUCT_ID, ADD_POST_CLOUT_POINTS} = require("../lib/src/constants");

describe("Posts:", () => {

    let snapshot;

    before(async () => {
        const userBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();

        const data = {
            userId: userBefore.ref.id,
            externalProductId: productBefore.data().externalId
        };

        await admin.firestore().collection('posts').doc('1').set(data);
        snapshot = await admin.firestore().collection('posts').doc('1').get();

    })

    it("should update user clout and product counter on create", async () => {
        const wrapped = test.wrap(functions.onPostCreate);

        const userBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const beforeClout = userBefore.data().clout;

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productPostsBefore = productBefore.data().postCount;

        // Call the function
        await wrapped(snapshot);

        const userAfter = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const afterClout = userAfter.data().clout;

        expect(afterClout).to.eql(beforeClout + ADD_POST_CLOUT_POINTS, "User clout should add favorite clout points on product favorite");

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productPostsAfter = productAfter.data().postCount

        expect(productPostsAfter).to.eql(productPostsBefore + 1, "Post creation should increment product post counter")

    })

    it("should update user clout and product counter on delete", async () => {

        await admin.firestore().collection('posts').doc('1').delete();

        const wrapped = test.wrap(functions.onPostDelete);

        const userBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const beforeClout = userBefore.data().clout;

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productPostsBefore = productBefore.data().postCount;

        // Call the function
        await wrapped(snapshot);

        const userAfter = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const afterClout = userAfter.data().clout;

        expect(afterClout).to.eql(beforeClout - ADD_POST_CLOUT_POINTS, "User clout should add favorite clout points on product favorite");

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productPostsAfter = productAfter.data().postCount

        expect(productPostsAfter).to.eql(productPostsBefore - 1, "Product should increment favorite counts")

    })
});