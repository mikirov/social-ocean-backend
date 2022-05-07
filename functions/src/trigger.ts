import * as functions from 'firebase-functions';
import {QueryDocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {Change} from "firebase-functions";

import admin from 'firebase-admin';
import {
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
    saveItemData, updateUserFieldsInCollection, hasMoreLikesThanCount, updatePostFieldsInCollection
} from './helper';
import {Product} from "./product";
import {ACCOUNT_CREATION_CLOUT_POINTS} from "./constants";

const  db = admin.firestore();

export const onItemFavorite = functions.firestore
    .document('favoriteItems/{favoriteItemId}')
    .onCreate(async (change: QueryDocumentSnapshot) => {
        const docRef = change.ref;
        let docData = change.data();

        try
        {
            let [user, userRef] = await getUserInfo(docData.userId);
            await updateUserCounters(db, user, userRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

            await saveItemData(docData, docRef, product, user);

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
            let [user, userRef] = await getUserInfo(docData.userId);
            await updateUserCounters(db, user, userRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

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
            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

            let [user, userRef] = await getUserInfo(docData.userId);
            await saveItemData(docData, docRef, product, user);
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

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

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

            let [user, userRef] = await getUserInfo(docData.userId);
            await updateUserCounters(db, user, userRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

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

            let [user, userRef] = await getUserInfo(docData.userId);
            await updateUserCounters(db, user, userRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);
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
            //we are checking if we are trying to add more than one like from the same user.
            // if we are we delete it
            //this trigger gets called after adding the document so the count can potentially be 2
            const hasLikedPost: boolean = await hasMoreLikesThanCount(db, 'postedItemLikes', 'postId', docData.postId, docData.userId, 1);
            if(hasLikedPost)
            {
                functions.logger.error("User " + docData.userId + "cannot like post " + docData.postId + " twice");
                await docRef.delete();
                return;
            }

            let [post, postRef] = await getPostInfo(docData.postId);
            await updatePostCounters(db, post, postRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

            const [user, userRef] = await getUserInfo(docData.userId);
            await saveItemData(docData, docRef, product, user, null, post);

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
            await updatePostCounters(db, post, postRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);
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
            //we are checking if we are trying to add more than one like from the same user.
            // if we are we delete it
            //this trigger gets called after adding the document so the count can potentially be 2
            const hasLikedRecommendation: boolean = await hasMoreLikesThanCount(db, 'recommendedItemLikes', 'recommendationId', docData.recommendationId, docData.userId, 1);
            if(hasLikedRecommendation)
            {
                functions.logger.error("User " + docData.userId + "cannot like recommendation " + docData.recommendationId + " twice");
                await docRef.delete();
                return;
            }

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

            let [recommendation, recommendationRef] = await getRecommendationInfo(docData.recommendationId);
            await updateRecommendationCounters(db, recommendation, recommendationRef);

            const [user, userRef] = await getUserInfo(docData.userId);
            await saveItemData(docData, docRef, product, user, recommendation, null);
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

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

            let [recommendation, recommendationRef] = await getRecommendationInfo(docData.recommendationId);
            await updateRecommendationCounters(db, recommendation, recommendationRef);
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


            let [toUserData, toUserRef] = await getUserInfo(docData.toUserId);
            await updateUserCounters(db, toUserData, toUserRef);

            let [fromUserData, fromUserRef] = await getUserInfo(docData.fromUserId);
            await updateUserCounters(db, fromUserData, fromUserRef);

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
            const current: Product = change.after.data() as Product;
            const currentRef = change.after.ref;
            const prev = change.before.data();
            if(JSON.stringify(prev) !== JSON.stringify(current))
            {
                await updateProductCounters(db, current, currentRef);
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
                let [user, userRef] = await getUserInfo(current.userId);
                await updateUserCounters(db, user, userRef);

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

export const onPostUpdate = functions.firestore
    .document('posts/{postId}')
    .onWrite(async (change: Change<QueryDocumentSnapshot>) => {
        try{

            const docData = change.after.data();
            const currentId = change.after.ref.id;
            const prev = change.before.data();
            if(JSON.stringify(prev) == JSON.stringify(docData))
            {
                functions.logger.error("Shouldn't do anything when data is not updated");
                return;
            }

            let [post, postRef] = await getPostInfo(docData.postId);
            await updatePostCounters(db, post, postRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

            const [user, userRef] = await getUserInfo(docData.userId);
            const docRef = change.after.ref;
            await saveItemData(docData, docRef, product, user);

            await updatePostFieldsInCollection(db, 'postedItemLikes', docData, currentId);

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationUpdate = functions.firestore
    .document('recommendations/{recommendationId}')
    .onUpdate(async (change: Change<QueryDocumentSnapshot>) => {
        try{


            const docData = change.after.data();
            const prev = change.before.data();
            if(JSON.stringify(prev) == JSON.stringify(docData))
            {
                functions.logger.error("Shouldn't do anything when data is not updated");
                return;
            }

            const docRef = change.after.ref;
            const currentId: string = change.after.id;

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

            let [recommendation, recommendationRef] = await getRecommendationInfo(docData.recommendationId);
            await updateRecommendationCounters(db, recommendation, recommendationRef);

            let [user, userRef] = await getUserInfo(docData.userId);
            await updateUserCounters(db, user, userRef);

            await saveItemData(docData, docRef, product, user);
            await updatePostFieldsInCollection(db, 'recommendedItemLikes', docData, currentId);
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
            const [user, userRef] = await getUserInfo(docData.userId);
            await updateUserCounters(db, user, userRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);

            //save all data
            await saveItemData(docData, docRef, product, user);

            //propagate data changes
            await updatePostFieldsInCollection(db,'recommendedItemLikes', docData, currentId);

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

            const [user, userRef] = await getUserInfo(docData.userId);
            await updateUserCounters(db, user, userRef);

            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await updateProductCounters(db, product, productRef);
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