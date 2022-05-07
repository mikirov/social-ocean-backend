const {expect, assert} = require('chai');
const admin = require("firebase-admin");

const test = require('firebase-functions-test')({
    projectId: 'social-ocean-6d649',
}, 'firebase-service-account.json');

// Import the exported function definitions from our functions/index.js file
const functions = require("../lib/src/index");
const {TEST_USER_ID, TEST_PRODUCT_ID, ADD_POST_CLOUT_POINTS, TEST_USER2_ID} = require("../lib/src/constants");

describe("Follows:", () => {

    let snapshot;

    before(async () => {
        const data = {
            fromUserId: TEST_USER_ID,
            toUserId: TEST_USER2_ID
        };

        await admin.firestore().collection('following').doc('1').set(data);
        snapshot = await admin.firestore().collection('following').doc('1').get();

    })

    it("update increment counters on follow", async () => {
        const wrapped = test.wrap(functions.onFollow);

        const fromUserBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const fromUserFollowingCountBefore = fromUserBefore.data().followingCount;
        const fromUserFollowerCountBefore = fromUserBefore.data().followerCount;

        const toUserBefore = await admin.firestore().collection('users').doc(TEST_USER2_ID).get();
        const toUserFollowingCountBefore = toUserBefore.data().followingCount;
        const toUserFollowerCountBefore = toUserBefore.data().followerCount;

        // Call the function
        await wrapped(snapshot);

        const fromUserAfter = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const fromUserFollowingCountAfter = fromUserAfter.data().followingCount;
        const fromUserFollowerCountAfter = fromUserAfter.data().followerCount;

        const toUserAfter = await admin.firestore().collection('users').doc(TEST_USER2_ID).get();
        const toUserFollowingCountAfter = toUserAfter.data().followingCount;
        const toUserFollowerCountAfter = toUserAfter.data().followerCount;

        expect(fromUserFollowerCountAfter).to.eql(fromUserFollowerCountBefore, "Follower user follower count should stay the same on follow");
        expect(fromUserFollowingCountAfter).to.eql(fromUserFollowingCountBefore + 1, "Follower user following count should increment on follow");

        expect(toUserFollowingCountAfter).to.eql(toUserFollowingCountBefore, "Followed user following count should stay the same on follow");
        expect(toUserFollowerCountAfter).to.eql(toUserFollowerCountBefore + 1, "Following user follower count should increment on follow");

    })

    it("should decrement user counters on unfollow", async () => {

        await admin.firestore().collection('following').doc('1').delete();

        const wrapped = test.wrap(functions.onUnfollow);

        const fromUserBefore = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const fromUserFollowingCountBefore = fromUserBefore.data().followingCount;
        const fromUserFollowerCountBefore = fromUserBefore.data().followerCount;

        const toUserBefore = await admin.firestore().collection('users').doc(TEST_USER2_ID).get();
        const toUserFollowingCountBefore = toUserBefore.data().followingCount;
        const toUserFollowerCountBefore = toUserBefore.data().followerCount;

        // Call the function
        await wrapped(snapshot);

        const fromUserAfter = await admin.firestore().collection('users').doc(TEST_USER_ID).get();
        const fromUserFollowingCountAfter = fromUserAfter.data().followingCount;
        const fromUserFollowerCountAfter = fromUserAfter.data().followerCount;

        const toUserAfter = await admin.firestore().collection('users').doc(TEST_USER2_ID).get();
        const toUserFollowingCountAfter = toUserAfter.data().followingCount;
        const toUserFollowerCountAfter = toUserAfter.data().followerCount;

        expect(fromUserFollowerCountAfter).to.eql(fromUserFollowerCountBefore, "Follower user follower count should stay the same on follow");
        expect(fromUserFollowingCountAfter).to.eql(fromUserFollowingCountBefore - 1, "Follower user following count should increment on follow");

        expect(toUserFollowingCountAfter).to.eql(toUserFollowingCountBefore, "Followed user following count should stay the same on follow");
        expect(toUserFollowerCountAfter).to.eql(toUserFollowerCountBefore - 1, "Following user follower count should increment on follow");

    })
});