const {expect, assert} = require('chai');
const admin = require("firebase-admin");

const test = require('firebase-functions-test')({
    projectId: 'social-ocean-6d649',
}, 'firebase-service-account.json');

// Import the exported function definitions from our functions/index.js file
const functions = require("../lib/src/index");
const {TEST_USER_ID, TEST_PRODUCT_ID, ADD_FAVORITE_CLOUT_POINTS} = require("../lib/src/constants");

describe("Product saves:", () => {

    let snapshot;

    before(async () => {
        const userBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();

        const data = {
            userId: userBefore.ref.id,
            externalProductId: productBefore.data().externalId
        };

        await admin.firestore().collection('savedItems').doc('1').set(data);
        snapshot = await admin.firestore().collection('savedItems').doc('1').get();

    })

    it("should update user clout and product counter on create", async () => {

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productFavoritesBefore = productBefore.data().saveCount;

        const wrapped = test.wrap(functions.onItemSaved);
        // Call the function
        await wrapped(snapshot);

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productFavoritesAfter = productAfter.data().saveCount

        expect(productFavoritesAfter).to.eql(productFavoritesBefore + 1, "Product should increment favorite counts")

    })

    it("should update user clout and product counter on delete", async () => {

        await admin.firestore().collection('savedItems').doc('1').delete();

        const wrapped = test.wrap(functions.onItemUnsaved);

        const productBefore = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productSavesBefore = productBefore.data().saveCount;

        // Call the function
        await wrapped(snapshot);

        const productAfter = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();
        const productSavesAfter = productAfter.data().saveCount

        expect(productSavesAfter).to.eql(productSavesBefore - 1, "Product should increment favorite counts")

    })
});