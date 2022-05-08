const {expect} = require('chai');
const admin = require("firebase-admin");

const test = require('firebase-functions-test')({
    projectId: 'social-ocean-6d649',
}, 'firebase-service-account.json');

// Import the exported function definitions from our functions/index.js file
const functions = require("../lib/src/index");
const {TEST_USER2_ID, TEST_USER_ID, TEST_PRODUCT_ID} = require("../lib/src/constants");
const {getUserFollowers} = require("../lib/src/helper");

describe("Activities:", () => {

    it("should create follow activity on follow", async () => {
        const wrapped = test.wrap(functions.onFollow);
        const activityWrapped = test.wrap(functions.onActivityCreated);

        const data = {
            fromUserId: TEST_USER2_ID,
            toUserId: TEST_USER_ID
        }
        await admin.firestore().collection('following').doc('1').set(data);
        const snapshot = await admin.firestore().collection('following').doc('1').get();
        await wrapped(snapshot);

        let activitySnapshot = await admin.firestore().collection('activityItems').where('fromUserId', '==', TEST_USER_ID).get();
        activitySnapshot = activitySnapshot.docs[activitySnapshot.docs.length - 1];
        await activityWrapped(activitySnapshot);

        let activityAfter = await admin.firestore().collection('activityItems').where('fromUserId', '==', TEST_USER_ID).get();
        activityAfter = activityAfter.docs[activityAfter.docs.length - 1].data();

        expect(activityAfter.dateAdded).to.exist;
        expect(activityAfter.fromAuthor).to.exist;
        expect(activityAfter.fromAuthorImage).to.exist;
        expect(activityAfter.fromAuthorRemoteImage).to.exist;
        expect(activityAfter.toAuthor).to.exist;
        expect(activityAfter.toAuthorImage).to.exist;
        expect(activityAfter.toAuthorRemoteImage).to.exist;
        expect(activityAfter.toAuthorScore).to.exist;
        expect(activityAfter.message).to.exist;
        expect(activityAfter.message).to.eql("started following you.");
        expect(activityAfter.type).to.exist;
        expect(activityAfter.type).to.eql("User");


        await admin.firestore().collection('following').doc('1').delete();
    })

    it("should make an activity for each follower of recommendation creator", async () => {
        const wrapped = test.wrap(functions.onRecommendationCreate);

        const product = await admin.firestore().collection('products').doc(TEST_PRODUCT_ID).get();

        const data = {
            userId: TEST_USER_ID,
            externalProductId: product.data().externalId
        }

        await admin.firestore().collection('recommendations').doc('1').set(data);
        const snapshot = await admin.firestore().collection('recommendations').doc('1').get();

        await wrapped(snapshot);

        // const followers = await getUserFollowers(admin.firestore(), TEST_USER_ID);
        // const promises = await Promise.all(followers.map((follower) => { return admin.firestore().collection('activityItems').where('fromUserId', '==', follower[1].id).get();}));
        //
        // const activities = promises.map(p => p.docs[p.docs.length - 1]);
        // const activityWrapped = test.wrap(functions.onActivityCreated);
        // await Promise.all(activities.map(activity => activityWrapped(activity)));
        //
        // const promisesAfter = await Promise.all(followers.map((follower) => { return admin.firestore().collection('activityItems').where('fromUserId', '==', follower[1].id).get();}));
        // const activitiesAfter = promises.map(p => p.docs[p.docs.length - 1].data());
        //
        //
        // activitiesAfter.forEach((activityAfter) => {
        //     expect(activityAfter.dateAdded).to.exist;
        //     expect(activityAfter.fromAuthor).to.exist;
        //     expect(activityAfter.fromAuthorImage).to.exist;
        //     expect(activityAfter.fromAuthorRemoteImage).to.exist;
        //     expect(activityAfter.toAuthor).to.exist;
        //     expect(activityAfter.toAuthorImage).to.exist;
        //     expect(activityAfter.toAuthorRemoteImage).to.exist;
        //     expect(activityAfter.toAuthorScore).to.exist;
        //     expect(activityAfter.message).to.exist;
        //     expect(activityAfter.message).to.eql("recommended " + product.title);
        //     expect(activityAfter.type).to.exist;
        //     expect(activityAfter.type).to.eql("Recommendation");
        // })
        // await admin.firestore().collection('recommendations').doc('1').delete();
    })

});