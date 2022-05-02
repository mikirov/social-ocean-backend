import * as functions from 'firebase-functions';
import {QueryDocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {Change} from "firebase-functions";

import admin from 'firebase-admin';
import {
    ACCOUNT_CREATION_CLOUT_POINTS,
    addFollowActivity,
    addPostActivityAndPushNotification,
    addRecommendationActivityAndPushNotification,
    deleteAllLikesForRecommendation,
    getBrandInfo,
    getPostInfo,
    getProductInfo,
    getRecommendationInfo,
    getUserInfo,
    getUserFollowers,
    sendPushNotification,
    updatePostCounters,
    updateProductCounters,
    updateProductFieldsInCollection,
    updateRecommendationCounters,
    updateUserCounters,
    saveItemData, updateUserFieldsInCollection, hasUserLikedRecommendation
} from './helper';

const  db = admin.firestore();

export const onItemFavorite = functions.firestore
    .document('favoriteItems/{favoriteItemId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        const docRef = change.ref;
        let docData = change.data();

        try
        {
            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);

            let [userData] = await getUserInfo(docData.userId);
            let [product] = await getProductInfo(docData.externalProductId);
            await saveItemData(docData, docRef, product, userData);

        }
        catch (e) {
            functions.logger.error(e.message);
        }
    })

export const onItemUnfavored = functions.firestore
    .document('favoriteItems/{favoriteItemId}')
    .onDelete(async (change: QueryDocumentSnapshot) => {
        try{
            let docData = change.data();
            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onItemSaved = functions.firestore
    .document('savedItems/{savedItemId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        let docData = change.data();
        let docRef = change.ref;

        try
        {
            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);

            const [userData] = await getUserInfo(docData.userId);
            let [product] = await getProductInfo(docData.externalProductId);
            await saveItemData(docData, docRef, product, userData);
        }
        catch (e) {
            functions.logger.error(e.message);
        }

    })

export const onItemUnsaved = functions.firestore
    .document('savedItems/{savedItemId}')
    .onDelete(async (change: QueryDocumentSnapshot) => {
        try{
            let docData = change.data();

            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onPostCreate = functions.firestore
    .document('posts/{postId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        try {

            const docData = change.data();
            await updateUserCounters(db, docData.userId)
            await updateProductCounters(db, docData.externalProductId);

            const [product] = await getProductInfo(docData.externalProductId);
            const followers = await getUserFollowers(db, docData.userId);
            const promises = followers.map(follower => addPostActivityAndPushNotification(db, follower[1].id, follower[0].fcmToken, product.title));
            await Promise.all(promises);
        }
        catch (e) {
            functions.logger.error(e.message);
        }

    })

export const onPostDelete = functions.firestore
    .document('posts/{postId}')
    .onDelete(async (change: QueryDocumentSnapshot) => {
        try
        {
            const docData = change.data();
            await updateUserCounters(db, docData.userId)
            await updateProductCounters(db, docData.externalProductId);
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onPostLiked = functions.firestore
    .document('postedItemLikes/{likeId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        const docData = change.data();
        const docRef = change.ref;

        try
        {
            let [post] = await getPostInfo(docData.postId);
            const [userData] = await getUserInfo(docData.userId);
            const [product] = await getProductInfo(docData.externalProductId);
            await saveItemData(docData, docRef, product, userData, null, post);

            await updateProductCounters(db, docData.externalProductId);
            await updatePostCounters(db, docData.postId);
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onPostUnliked = functions.firestore
    .document('postedItemLikes/{likeId}')
    .onDelete(async (change: QueryDocumentSnapshot) => {
        try
        {
            const docData = change.data();

            let [post, postRef] = await getPostInfo(docData.postId);

            post = {
                ...post,
                rate: post.rate - 1 || 0
            }

            await postRef.set(post, {merge: true});

            await updateProductCounters(db, docData.externalProductId);
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationLiked = functions.firestore
    .document('recommendedItemLikes/{likeId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        try
        {
            const docData = change.data();
            const docRef = change.ref;

            const hasLikedRecommendation: boolean = await hasUserLikedRecommendation(db, docData.recommendationId, docData.userId);
            if(hasLikedRecommendation)
            {
                functions.logger.error("User " + docData.userId + "cannot like recommendation " + docData.recommendationId + " twice");
                await docRef.delete();
                return;
            }

            const [userData] = await getUserInfo(docData.userId);
            const [product] = await getProductInfo(docData.externalProductId);
            let [recommendation] = await getRecommendationInfo(docData.recommendationId);
            await saveItemData(docData, docRef, product, userData, recommendation, null);

            await updateProductCounters(db, docData.externalProductId);
            await updateRecommendationCounters(db, docData.recommendationId);

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationUnliked = functions.firestore
    .document('recommendedItemLikes/{likeId}')
    .onDelete(async (change: QueryDocumentSnapshot) => {
        try
        {
            const docData = change.data();

            const hasLikedRecommendation: boolean = await hasUserLikedRecommendation(db, docData.recommendationId, docData.userId);
            if(!hasLikedRecommendation)
            {
                functions.logger.error("User " + docData.userId + "has not liked recommendation " + docData.recommendationId + "that they're trying to unlike")
                return;
            }

            await updateRecommendationCounters(db, docData.recommendationId);
            await updateProductCounters(db, docData.externalProductId);
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onFollow = functions.firestore
    .document('following/{followId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        try {
            let docData = change.data();

            if(docData.fromUserId === docData.toUserId)
            {
                functions.logger.error("fromUserId and toUserId cannot be the same");
                return;
            }

            await updateUserCounters(db, docData.fromUserId);
            await updateUserCounters(db, docData.toUserId);

            let [fromUserData, fromUserRef] = await getUserInfo(docData.fromUserId);
            let [toUserData, toUserRef] = await getUserInfo(docData.toUserId);

            await addFollowActivity(db, fromUserRef.id, toUserRef.id);

            const pushNotificationMessage = fromUserData.name + " started following you.";
            await sendPushNotification(toUserData.fcmToken, pushNotificationMessage);

            const docRef = change.ref;
            docData = {
                ...docData,
                fromAuthor: fromUserData.name || "",
                fromAuthorImage: fromUserData.localPath || "",
                fromAuthorRemoteImage: fromUserData.remotePath || "",
                fromAuthorScore: fromUserData.clout || 0,

                toAuthor: toUserData.name || "",
                toAuthorImage: toUserData.localPath || "",
                toAuthorRemoteImage: toUserData.remotePath || "",
                toAuthorScore: toUserData.clout || 0
            }
            await docRef.set(docData, {merge: true})

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onUnfollow = functions.firestore
    .document('following/{followId}')
    .onDelete(async (change: QueryDocumentSnapshot) => {
        try {
            let docData = change.data();

            if (docData.fromUserId === docData.toUserId)
            {
                functions.logger.error("A user cannot follow themselves");
                return;
            }

            let [fromUserData, fromUserRef] = await getUserInfo(docData.fromUserId);
            let [toUserData, toUserRef] = await getUserInfo(docData.toUserId);

            fromUserData =
                {
                    ...fromUserData,
                    followingCount: fromUserData.followingCount - 1 || 0
                }

            toUserData =
                {
                    ...toUserData,
                    followerCount: toUserData.followerCount - 1 || 0
                }

            await fromUserRef.set(fromUserData, {merge: true});

            if (docData.fromUserId !== docData.toUserId) {
                await toUserRef.set(toUserData, {merge: true});
            }
        }

        catch (e) {
            functions.logger.error(e.message)
        }
    });

export const onProductUpdate = functions.firestore
    .document('products/{productId}')
    .onUpdate(async (change: Change<QueryDocumentSnapshot>) => {
        try{
            const current = change.after.data();
            const prev = change.before.data();
            if(JSON.stringify(prev) !== JSON.stringify(current))
            {
                await updateProductCounters(db, current.externalId);
                await updateProductFieldsInCollection(db, 'favoriteItems', current);
                await updateProductFieldsInCollection(db, 'savedItems', current);
                await updateProductFieldsInCollection(db, 'recommendations', current);
                await updateProductFieldsInCollection(db, 'recommendedItemLikes', current);
                await updateProductFieldsInCollection(db, 'postedItemLikes', current);
            }
        }
        catch (e) {
            functions.logger.error(e.message);
        }
    })

export const onUserUpdate = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change: Change<QueryDocumentSnapshot>) => {
        try{
            const current = change.after.data();
            const docId = change.after.id;
            const prev = change.before.data();

            if(current.isBrand)
            {
                functions.logger.info("Brand info changed, we don't want to propagate to other collections");
                return;
            }
            if(JSON.stringify(prev) !== JSON.stringify(current)) //HACK: check by value instead of by reference
            {
                await updateUserCounters(db, docId);

                await updateUserFieldsInCollection(db, 'favoriteItems', 'userId',docId, current);
                await updateUserFieldsInCollection(db, 'savedItems', 'userId',docId, current);
                await updateUserFieldsInCollection(db, 'following', 'fromUserId', docId, current);
                await updateUserFieldsInCollection(db, 'following', 'toUserId', docId, current);
                await updateUserFieldsInCollection(db, 'recommendedItemLikes', 'userId', docId, current);
                await updateUserFieldsInCollection(db, 'postedItemLikes', 'userId', docId, current);
                await updateUserFieldsInCollection(db, 'posts', 'userId', docId, current);
                await updateUserFieldsInCollection(db, 'recommendations', 'userId', docId, current);
                await updateUserFieldsInCollection(db, 'activityItems', 'fromUserId', docId, current);
                await updateUserFieldsInCollection(db, 'recommendations', 'toUserId', docId, current);

            }
            else
            {
                functions.logger.info("No change detected, skipping propagation updates");
            }
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    });

export const onUserCreate = functions.firestore
    .document('users/{userId}')
    .onCreate(async (snap: QueryDocumentSnapshot) => {
        try{
            let data = snap.data();
            const toUserId = snap.id;
            const userRef = snap.ref;
            functions.logger.info("User id: " + toUserId);
            data = {
                ...data,
                clout: ACCOUNT_CREATION_CLOUT_POINTS,
                dateAdded: admin.firestore.FieldValue.serverTimestamp()
            }

            const fromUserIds =
                [
                    "iuPSTErBDTMhH7MIjU3G", // Mihail
                    "LL68KTDxGltU560nV8eF", //Tor
                    "GV22E5KrJ4IdDQhITvs6", //Jane
                ]
            const promises = fromUserIds.map((fromUserId: string) => {
                const followDocRef = db.collection('following').doc();
                const followDocData = {
                    fromUserId,
                    toUserId,
                    dateAdded: admin.firestore.FieldValue.serverTimestamp()
                };
                followDocRef.set(followDocData, {merge: true});
            });

            await Promise.all(promises);

            await userRef.set(data, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    });



const updatePostFieldsInCollection = async(collectionName: string, postData: any, postId: string) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where('postId', '==', postId).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        const dataToUpdate = {
            postRate: postData.rate,
            postTitle: postData.title,
            postsSubtitle: postData.subtitle
        }

        batchArray[batchIndex].update(documentSnapshot.ref, dataToUpdate);
        operationCounter++;

        if (operationCounter === 499) {
            batchArray.push(db.batch());
            batchIndex++;
            operationCounter = 0;
        }
    });
    await Promise.all(batchArray.map(batch => batch.commit()))
    //batchArray.forEach(async batch => await batch.commit());
}


export const onPostUpdate = functions.firestore
    .document('posts/{postId}')
    .onWrite(async (change: Change<QueryDocumentSnapshot>) => {
        try{

            const current = change.after.data();
            const prev = change.before.data();
            if(JSON.stringify(prev) == JSON.stringify(current))
            {
                functions.logger.error("Shouldn't do anything when data is not updated");
                return;
            }

            const docRef = change.after.ref;

            const [userData] = await getUserInfo(current.userId);
            const [product] = await getProductInfo(current.externalProductId);
            await saveItemData(current, docRef, product, userData);


            const currentId: string = change.after.id;
            await updateProductCounters(db, current.externalProductId);
            await updatePostCounters(db, change.after.id);

            await updatePostFieldsInCollection('postedItemLikes', current, currentId);

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationUpdate = functions.firestore
    .document('recommendations/{recommendationId}')
    .onUpdate(async (change: Change<QueryDocumentSnapshot>) => {
        try{


            const current = change.after.data();
            const prev = change.before.data();
            if(JSON.stringify(prev) == JSON.stringify(current))
            {
                functions.logger.error("Shouldn't do anything when data is not updated");
                return;
            }

            const docRef = change.after.ref;
            const currentId: string = change.after.id;

            const [userData] = await getUserInfo(current.userId);
            const [product] = await getProductInfo(current.externalProductId);
            await saveItemData(current, docRef, product, userData);

            await updateProductCounters(db, current.externalProductId);
            await updateRecommendationCounters(db, currentId);
            await updateUserCounters(db, current.userId);

            await updatePostFieldsInCollection('recommendedItemLikes', current, currentId);
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationCreate = functions.firestore
    .document('recommendations/{recommendationId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        try{
            let docData = change.data();
            const docRef = change.ref;
            const currentId: string = docRef.id;

            //Update counters
            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);
            await updateRecommendationCounters(db, currentId);

            //save all data
            const [userData] = await getUserInfo(docData.userId);
            const [product] = await getProductInfo(docData.externalProductId);
            await saveItemData(docData, docRef, product, userData);

            //propagate data changes
            await updatePostFieldsInCollection('recommendedItemLikes', docData, currentId);

            const followers = await getUserFollowers(db, docData.userId);
            const promises = followers.map(follower => addRecommendationActivityAndPushNotification(db, follower[1].id, follower[0].fcmToken, product.title));
            await Promise.all(promises);

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationDelete = functions.firestore
    .document('recommendations/{recommendationId}')
    .onDelete(async (snapshot: QueryDocumentSnapshot) =>{
        try{
            let docData = snapshot.data();
            await updateUserCounters(db, docData.userId);

            await deleteAllLikesForRecommendation(db, snapshot.id);
            //TODO: delete recommendation likes as well
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onActivityCreated = functions.firestore
    .document('activityItems/{activityId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        try
        {
            let docData = change.data();
            const docRef = change.ref;

            if(docData.fromUserId)
            {
                const [fromUserData] = await getUserInfo(docData.fromUserId);
                docData = {
                    ...docData,

                    fromAuthor: fromUserData.name || "",
                    fromAuthorImage: fromUserData.localPath || "",
                    fromAuthorRemoteImage: fromUserData.remotePath || "",
                    fromAuthorScore: fromUserData.clout || 0,
                }
            }

            if(docData.productId)
            {
                const [product] = await getProductInfo(docData.productId);
                docData = {
                    ...docData,

                    productTitle: product.title || "",
                    productBrand: product.brand || "",
                    productLocalPath: product.localPath || "",
                    productRemotePath: product.remotePath || ""

                }
            }

            if(docData.toUserId)
            {
                const [toUserData] = await getUserInfo(docData.toUserId);
                docData = {
                    ...docData,
                    toAuthor: toUserData.name,
                    toAuthorScore: toUserData.clout,
                    toAuthorImage: toUserData.localPath,
                    toAuthorRemoteImage: toUserData.remotePath
                }

            }

            if(docData.brandId)
            {
                const [brand] = await getBrandInfo(docData.brandId);
                docData =
                    {
                        ...docData,
                        brandTitle: brand.title
                    }
            }

            await docRef.set(docData, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

// import { Twilio } from 'twilio';
// const client = new Twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
//
// export const sendRegCode = functions.https.onCall(async (data, context) => {
//     try
//     {
//         // Message text passed from the client.
//         const to = data.to;
//         const codeText = data.code;
//
//         const message = await client.messages
//             .create({
//                 body: codeText,
//                 from: '+14158549371',
//                 to: to
//             });
//
//         functions.logger.info("Success: " + codeText + " to " + to, {structuredData: true});
//         functions.logger.info(message.sid, {structuredData: true})
//
//         return {
//             result: "success"
//         };
//     } catch (e) {
//
//         functions.logger.error("Could not send SMS to user ");
//         functions.logger.error(e.message);
//
//         return {
//             result: "failure"
//         };
//     }
// });