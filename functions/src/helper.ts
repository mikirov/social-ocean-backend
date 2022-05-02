
import * as functions from "firebase-functions";
import admin from 'firebase-admin';
import {Product} from "./product";
import {User} from "./user";
import {Post} from "./post";
import {Brand} from "./brand";

export const ACCOUNT_CREATION_CLOUT_POINTS = 50;
export const ADD_BIO_CLOUT_POINTS = 20;
export const ADD_FAVORITE_CLOUT_POINTS = 50;
export const ADD_RECOMMENDATION_CLOUT_POINTS = 75;
export const ADD_POST_CLOUT_POINTS = 75;
export const PREFERRED_USER_FAVORITE_THRESHOLD = 7;

export const getProductInfo = async (externalProductId:string): Promise<[any, FirebaseFirestore.DocumentReference]> => {

    const productsSnapshot: FirebaseFirestore.DocumentData = await admin.firestore().collection('products').where('externalId', '==', externalProductId).get();
    if(productsSnapshot == null || productsSnapshot.docs == null || productsSnapshot.docs.length == 0)
    {
        throw new Error("couldn't find product");
    }
    const product: Product = productsSnapshot.docs[0].exists ? productsSnapshot.docs[0].data() as Product : null;
    const productRef: FirebaseFirestore.DocumentReference = productsSnapshot.docs[0].exists ? productsSnapshot.docs[0].ref : null;
    if(product == null || productRef == null)
    {
        throw new Error("product or product ref are null");
    }
    functions.logger.info(product);
    functions.logger.info(productRef);

    return [product, productRef];
}

export const getRecommendationInfo = async (recommendationId: string): Promise<[any, FirebaseFirestore.DocumentReference]> => {

    const recommendationRef: FirebaseFirestore.DocumentReference = admin.firestore().collection('recommendations').doc(recommendationId);

    const recommendationSnapshot: FirebaseFirestore.DocumentData = await recommendationRef.get();
    if(recommendationSnapshot == null || !recommendationSnapshot.exists)
    {
        throw new Error("couldn't find recommendation");
    }
    const recommendation = recommendationSnapshot.data();

    return [recommendation, recommendationRef];
}

export const getBrandInfo = async (brandId: string): Promise<[Brand, FirebaseFirestore.DocumentReference]> => {

    const brandRef: FirebaseFirestore.DocumentReference = admin.firestore().collection('brands').doc(brandId);

    const brandSnapshot: FirebaseFirestore.DocumentData = await brandRef.get();
    if(brandSnapshot == null || !brandSnapshot.exists)
    {
        throw new Error("couldn't find recommendation");
    }
    const brand = brandSnapshot.data();

    return [brand, brandRef];
}

export const getPostInfo = async (postId:string): Promise<[Post, FirebaseFirestore.DocumentReference]> => {

    const postRef = admin.firestore().collection('posts').doc(postId);

    const postSnapshot: FirebaseFirestore.DocumentData = await postRef.get();
    if(postSnapshot == null || !postSnapshot.exists)
    {
        throw new Error(`couldn't find post ${postId}`);
    }
    const post: Post = postSnapshot.data();

    return [post, postRef];
}

export const getUserInfo = async (userId: string): Promise<[User, FirebaseFirestore.DocumentReference]> => {

    const userSnapshot: FirebaseFirestore.DocumentSnapshot = await admin.firestore().collection('users').doc(userId).get();
    if(userSnapshot  == null || !userSnapshot.exists)
    {
        throw new Error(`could not find user data for saved item user id ${userId}`);
    }

    const userData: User = userSnapshot.data() as User;
    const userRef: FirebaseFirestore.DocumentReference = userSnapshot.ref;
    if(userData == null || userRef == null)
    {
        throw new Error("Could not get user data");
    }

    return [userData, userRef];
}

export const sendPushNotification = async (token: string, body: string) => {
    const notification = {
        token,
        notification: {
            title: 'Social Ocean.',
            body
        },
        data: {
            body
        }
    }
    await admin.messaging().send(notification, false);
    functions.logger.info("Sent notification to token: " + token);
}

export const updateUserCounters = async(db: any, userId: string) => {
    let [user, userRef] = await getUserInfo(userId);

    const followingSnapshot = await db.collection('following').where('fromUserId', '==', userId).get();
    const followingCount = followingSnapshot.docs.filter(doc => doc.exists).length;

    const followersSnapshot = await db.collection('following').where('toUserId', '==', userId).get();
    const followerCount = followersSnapshot.docs.filter(doc => doc.exists).length;

    const postSnapshot = await db.collection('posts').where('userId', '==', userId).get();
    const postCount = postSnapshot.docs.filter(doc => doc.exists).length;

    const favoriteSnapshot = await db.collection('favoriteItems').where('userId', '==', userId).get();
    const favoriteCount = favoriteSnapshot.docs.filter(doc => doc.exists).length;

    const recommendationSnapshot = await db.collection('recommendations').where('userId', '==', userId).get();
    const recommendationCount = recommendationSnapshot.docs.filter(doc => doc.exists).length;

    let clout = ACCOUNT_CREATION_CLOUT_POINTS;
    if(user.bio)
    {
        clout += ADD_BIO_CLOUT_POINTS;
    }

    if(postCount > 0)
    {
        clout += postCount * ADD_POST_CLOUT_POINTS;
    }

    if(recommendationCount > 0)
    {
        clout += recommendationCount * ADD_RECOMMENDATION_CLOUT_POINTS;
    }

    if(favoriteCount > 0)
    {
        clout += favoriteCount * ADD_FAVORITE_CLOUT_POINTS;
    }

    const productsFavoritedByUser: number = await getNumberProductsFavoritedByUser(db, userId);

    if(productsFavoritedByUser == PREFERRED_USER_FAVORITE_THRESHOLD && !user.isPreferred)
    {
        user = {
            ...user,
            isPreferred: true
        };

        await addProUserActivity(db, userId);
    }

    user =
        {
            ...user,
            followerCount,
            followingCount,
            clout
            //dateUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
    //this will trigger user update which will propagate changes to all other collections
    await userRef.set(user, {merge: true});
}

export const updateProductCounters = async (db: any, externalId: string) => {

    let [product, productRef] = await getProductInfo(externalId);

    const savedSnapshot = await db.collection('savedItems').where('externalProductId', '==', product.externalId).get();
    const saveCount: number = savedSnapshot.docs.filter(doc => doc.exists).length;

    const favoriteSnapshot = await db.collection('favoriteItems').where('externalProductId', '==', product.externalId).get();
    const favoriteCount: number = favoriteSnapshot.docs.filter(doc => doc.exists).length;

    const postSnapshot = await db.collection('posts').where('externalProductId', '==', product.externalId).get();
    const postCount: number = postSnapshot.docs.filter(doc => doc.exists).length;

    const recommendationSnapshot = await db.collection('recommendations').where('externalProductId', '==', product.externalId).get();
    const recommendationCount: number = recommendationSnapshot.docs.filter(doc => doc.exists).length;

    const postLikesSnapshot = await db.collection('postedItemLikes').where('externalProductId', '==', product.externalId).get();
    const totalPostLikes: number = postLikesSnapshot.docs.filter(doc => doc.exists).length;

    const recommendationLikesSnapshot = await db.collection('recommendedItemLikes').where('externalProductId', '==', product.externalId).get();
    const totalRecommendationLikes: number = recommendationLikesSnapshot.docs.filter(doc => doc.exists).length;


    product = {
        ...product,
        saveCount,
        favoriteCount,
        postCount,
        recommendationCount,
        totalPostLikes,
        totalRecommendationLikes
    }

    await productRef.set(product, {merge: true});
}

export const updateRecommendationCounters = async (db: any, recommendationId: string) => {

    let [recommendation, recommendationRef] = await getRecommendationInfo(recommendationId);

    const savedSnapshot = await db.collection('recommendedItemLikes').where('recommendationId', '==', recommendationId).get();
    const rate: number = savedSnapshot.docs.filter(doc => doc.exists).length;

    recommendation = {
        ...recommendation,
        rate,
    }

    await recommendationRef.set(recommendation, {merge: true});
}

export const updatePostCounters = async (db: any, postId: string) => {

    let [post, postRef] = await getPostInfo(postId);

    const savedSnapshot = await db.collection('postedItemLikes').where('postId', '==', postId).get();
    const rate: number = savedSnapshot.docs.filter(doc => doc.exists).length;

    post = {
        ...post,
        rate,
    }

    await postRef.set(post, {merge: true});
}

export const updateProductFieldsInCollection = async(db, collectionName: string, productData) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where('externalProductId', '==', productData.externalId).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        const dataToUpdate = {
            productBrand: productData.brand,
            productDomain: productData.domain,
            productLocalPath: productData.localPath,
            productRemotePath: productData.remotePath,
            productTitle: productData.title,
            productSaveCount: productData.saveCount,
            productFavoriteCount: productData.favoriteCount}

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

//this function checks if there is more than one like for a recommendation by a user
export const hasMoreThanOneLike = async (db, collectionName: string, fieldName: string, recommendationId: string, userId: string) : Promise<boolean> => {
    const snapshots = await db.collection(collectionName).where(fieldName, '==', recommendationId).get();
    const likerIds: string[] = snapshots.docs.filter(doc => doc.exists).map(doc => doc.data().userId);
    let likeCount = 0;
    likerIds.forEach((id) => id == userId ? likeCount + 1 : null)
    return likeCount > 1;
}


export const getNumberProductsFavoritedByUser = async (db: any, userId: string) => {
    const snapshots = await db.collnection('favoriteItems').where('userId', '==', userId).get();
    return snapshots.docs.filter(doc => doc.exists).length;

}

export const updateUserFieldsInCollection = async(db, collectionName: string, idToCheck: string, id: string, userData) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where(idToCheck, '==', id).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        let dataToUpdate = null;
        switch (idToCheck) {
            case 'userId':
            {
                dataToUpdate = {
                    author: userData.name,
                    authorScore: userData.clout,
                    authorImage: userData.localPath,
                    authorRemoteImage: userData.remotePath,
                    authorIsBrand: userData.isBrand,
                    authorIsApproved: userData.isApproved,
                    authorIsPreferred: userData.isPreferred
                }
            }
                break;
            case 'fromUserId':
            {
                dataToUpdate =
                    {
                        fromAuthor: userData.name,
                        fromAuthorScore: userData.clout,
                        fromAuthorImage: userData.localPath,
                        fromAuthorRemoteImage: userData.remotePath,
                        fromAuthorIsBrand: userData.isBrand,
                        fromAuthorIsApproved: userData.isApproved,
                        fromAuthorIsPreferred: userData.isPreferred
                    }
            }
                break;
            case 'toUserId':
            {
                dataToUpdate =
                    {
                        toAuthor: userData.name,
                        toAuthorScore: userData.clout,
                        toAuthorImage: userData.localPath,
                        toAuthorRemoteImage: userData.remotePath,
                        toAuthorIsBrand: userData.isBrand,
                        toAuthorIsApproved: userData.isApproved,
                        toAuthorIsPreferred: userData.isPreferred
                    }
            }
                break;
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

export const updateRecommendationFieldsInCollection = async(db, collectionName: string, recommendationData: any, recommendationId: string) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where('recommendationId', '==', recommendationId).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        const dataToUpdate = {
            recommendationRate: recommendationData.rate,
            recommendationTile: recommendationData.title,
            recommendationSubtitle: recommendationData.subtitle,
            recommendationDetails: recommendationData.details
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

export const deleteAllLikesForRecommendation = async (db, recommendationId: string) => {
    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection('recommendedItemLikes').where('recommendationId', '==', recommendationId).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        batchArray[batchIndex].delete(documentSnapshot.ref);
        operationCounter++;

        if (operationCounter === 499) {
            batchArray.push(db.batch());
            batchIndex++;
            operationCounter = 0;
        }
    });
    await Promise.all(batchArray.map(batch => batch.commit()))
}

export const addFollowActivity = async (db, fromUserId, toUserId) => {
    const activityDocRef = db.collection('activityItems').doc();
    const followActivityData = {
        fromUserId,
        toUserId,
        message: "started following you.",
        type: "User",
        dateAdded: admin.firestore.FieldValue.serverTimestamp()
    };

    await activityDocRef.set(followActivityData, {merge: true});
}

export const addProUserActivity = async(db, toUserId: string) => {
    const activityDocRef = db.collection('activityItems').doc();
    const followActivityData = {
        toUserId: toUserId,
        message: "Congrats. You’ve unlocked Pro features and benefits 💕",
        type: "Message",
        dateAdded: admin.firestore.FieldValue.serverTimestamp()
    };

    await activityDocRef.set(followActivityData, {merge: true});
}

export const addRecommendationActivityAndPushNotification = async(db, toUserId: string, token: string, productName: string) => {
    const activityDocRef = db.collection('activityItems').doc();
    const message = "recommended " + productName;
    const followActivityData = {
        toUserId: toUserId,
        message,
        type: "Recommendation",
        dateAdded: admin.firestore.FieldValue.serverTimestamp()
    };

    await activityDocRef.set(followActivityData, {merge: true});

    await sendPushNotification(token, message);
}

export const addPostActivityAndPushNotification = async(db, toUserId: string, token: string, productName: string) => {
    const activityDocRef = db.collection('activityItems').doc();
    const message = "added a post for " + productName;
    const followActivityData = {
        toUserId: toUserId,
        message,
        type: "Post",
        dateAdded: admin.firestore.FieldValue.serverTimestamp()
    };

    await activityDocRef.set(followActivityData, {merge: true});

    await sendPushNotification(token, message);
}

export const getUserFollowers = async(db, userId) : Promise<any> => {
    const snapshots = await db.collection('following').where('toUserId', '==', userId).get();
    const promises = snapshots.docs.filter(doc => doc.exists).map(doc => getUserInfo(doc.data().fromUserId));
    return await Promise.all(promises);

}

export const saveItemData = async (docData, docRef, product, userData, recommendation = null, post = null) => {

    docData = {
        ...docData,

        author: userData.name || "",
        authorImage: userData.localPath || "",
        authorRemoteImage: userData.remotePath || "",
        authorScore: userData.clout || "",
        authorIsBrand: userData.isBrand,
        authorIsApproved: userData.isApproved,
        authorIsPreferred: userData.isPreferred,

        productTitle: product.title || "",
        productBrand: product.brand || "",
        productDomain: product.domain || "",
        productFavoriteCount: product.favoriteCount || 0,
        productSaveCount: product.saveCount || 0,
        productLocalPath: product.localPath || "",
        productRemotePath: product.remotePath || ""
    }
    if(recommendation)
    {
        docData = {
            ...docData,
            recommendationTitle: recommendation.title || "",
            recommendationSubtitle: recommendation.subtitle || "",
            recommendationDetails: recommendation.details || "",
            recommendationRate: recommendation.rate || ""
        }
    }

    if(post)
    {
        docData = {
            ...docData,
            postTitle: post.title || "",
            postSubtitle: post.subtitle || "",
            postDetails: post.details || "",
            postRate: post.rate || 0
        }
    }

    await docRef.set(docData, {merge: true});
}
