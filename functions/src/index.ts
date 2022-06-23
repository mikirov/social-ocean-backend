import Express from 'express';
import cors from 'cors';
import * as functions from "firebase-functions";
import admin from 'firebase-admin';
import util from 'util';

admin.initializeApp();

const  db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

export {onItemFavorite, onItemUnfavored, onItemSaved, onItemUnsaved,
    onPostLiked, onPostUnliked,
    onPostCreate, onPostUpdate, onPostDelete,
    onFollow, onUnfollow,
    onProductUpdate,
    onUserCreate, onUserUpdate,
    onRecommendationUpdate, onRecommendationCreate, onRecommendationDelete,
    onRecommendationLiked, onRecommendationUnliked,
    onActivityCreated,
    onBrandUpdate} from './trigger';

import {getPostInfo, getProductInfo, getRecommendationInfo, getUserInfo, updateProductCounters, updateUserCounters } from './helper';
import express from 'express';

import Shopify, {
    ApiVersion,
    AuthQuery
} from '@shopify/shopify-api';

let app: Express.Application = Express();
app.use(Express.urlencoded({ extended: false }));
const options: cors.CorsOptions = {
    origin: "*",
};
app.use(cors(options));

//app.use(passport.authenticate('basic', { session: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/products', async (req: Express.Request, res: Express.Response) => {
    if(!req.query || !req.query.url)
    {
        res.status(400).send("Please specify domain to get products for");
        return;
    }

    //console.log(req.query.url)
    const domain: string = req.query.url as string;
    console.log(domain);
    const snapshot = await admin.firestore().collection('products').where('domain', '==', domain).get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(400).send("There aren't any products for domain or collection hasn't been created yet.")
        return;
    }
    const products = snapshot.docs.map(doc => doc.data());

    if(!products || products.length == 0)
    {
        res.status(404).send("Could not find any products for domain");
        return;
    }

    res.status(200).send(products);
})

app.get("/parsedDomains", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await db.collection('parsedDomains').get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(500).send("There aren't any parsed domains or collection hasn't been created yet.")
        return;
    }
    const domains = snapshot.docs.map(doc => doc.data().domain);

    if(!domains || domains.length === 0)
    {
        res.status(404).send("Could not find any parsed domains");
        return;
    }

    res.status(200).send(Array.from(new Set(domains)));
});

app.get("/unparsableDomains", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await db.collection('unparsableDomains').get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(500).send("There aren't any unparsable domains or collection hasn't been created yet.")
        return;
    }
    const domains = snapshot.docs.map(doc => doc.data().domain);

    if(!domains)
    {
        res.status(404).send("Could not find any unparsable domains");
        return;
    }

    if(domains.length === 0)
    {
        res.status(404).send("Domains length is zero");
        return;
    }

    res.status(200).send(Array.from(new Set(domains)));
})

const updateFollowCounts = async (req: Express.Request, res: Express.Response) => {
    try {
        const followingSnapshot = await db.collection('following').get();
        if(!followingSnapshot || !followingSnapshot.docs)
        {
            res.status(500).send("Couldn't get following colelction")
            return;
        }
        const followingDocs = followingSnapshot.docs.map(doc => doc.data());
        const userFollowers = [];
        const userFollowing = [];

        //recalculate followers
        followingDocs.forEach(data => {
            userFollowing[data.fromUserId] = userFollowing[data.fromUserId] + 1 || 1;
            userFollowers[data.toUserId] = userFollowers[data.toUserId] + 1 || 1;
        });

        const snapshot = await db.collection('users').get();
        if(!snapshot || !snapshot.docs)
        {
            res.status(500).send("Couldn't get following colelction")
            return;
        }

        //TODO: iterate over users instead?
        for(const key in userFollowing)
        {
            let [user, userRef] = await getUserInfo(key);
            user.followingCount = userFollowing[key];
            functions.logger.info(util.inspect(user, {showHidden: false, depth: null}));

            await userRef.set(user, {merge: true});

            functions.logger.info(`user ${key} has following count ${userFollowing[key]}`)
        }

        for(const key in userFollowers)
        {
            let [user, userRef] = await getUserInfo(key);
            user.followerCount = userFollowers[key];
            functions.logger.info(util.inspect(user, {showHidden: false, depth: null}));

            await userRef.set(user, {merge: true});

            functions.logger.info(`user ${key} has follower count ${userFollowers[key]}`)
        }
    }catch (e) {
        functions.logger.error(e.message)
    }

}

const updateProductCounts = async () => {
    try{
        const savedSnapshot = await db.collection('savedItems').get();
        const savedDatas = savedSnapshot.docs.filter(doc => doc.exists).map(doc => doc.data());
        const productSaveCount = []
        savedDatas.forEach(s => {
            productSaveCount[s.externalProductId] = productSaveCount[s.externalProductId] + 1 || 1

            functions.logger.info(util.inspect(s, {showHidden: false, depth: null}));
        });

        const favoriteSnapshot = await db.collection('favoriteItems').get();
        const favoriteDatas = favoriteSnapshot.docs.filter(doc => doc.exists).map(doc => doc.data());
        const productFavoriteCount = []
        favoriteDatas.forEach(s => {
            productFavoriteCount[s.externalProductId] = productFavoriteCount[s.externalProductId] + 1 || 1

            functions.logger.info(util.inspect(s, {showHidden: false, depth: null}));
        });


        for(const key in productSaveCount)
        {
            let [product, productRef] = await getProductInfo(key);
            product.saveCount = productSaveCount[key];

            functions.logger.info(util.inspect(product, {showHidden: false, depth: null}));
            // @ts-ignore
            await productRef.set(product, {merge: true, ignoreUndefinedProperties: true});
            functions.logger.info(`product ${key} has save count ${productSaveCount[key]}`);
        }

        for(const key in productFavoriteCount)
        {
            let [product, productRef] = await getProductInfo(key);
            product.favoriteCount = productFavoriteCount[key];

            functions.logger.info(util.inspect(product, {showHidden: false, depth: null}));
            // @ts-ignore
            await productRef.set(product, {merge:true, ignoreUndefinedProperties: true});
            functions.logger.info(`product ${key} has favorite count ${productFavoriteCount[key]}`);
        }
    }
    catch (e) {
        functions.logger.error(e.message);
    }

}

const updatePostCounts = async () => {
    try {
        const postSnapshot = await db.collection('postedItemLikes').get();
        const postDatas = postSnapshot.docs.map(doc => doc.data());
        const postRate = []
        postDatas.forEach(pl => postRate[pl.postId] = postRate[pl.postId] + 1 || 1);

        for(const key in postRate)
        {
            let [post, postRef] = await getPostInfo(key);
            post.rate = postRate[key];
            functions.logger.info(util.inspect(post, {showHidden: false, depth: null}));

            // @ts-ignore
            await postRef.set(post, {merge: true, ignoreUndefinedProperties: true});

            functions.logger.info(`product ${key} has favorite count ${postRate[key]}`);
        }
    }
    catch (e) {
        functions.logger.error(e.message);
    }

}

const updateRecommendationCounts = async () => {
    try {
        const recommendationSnapshot = await db.collection('recommendedItemLikes').get();
        const recDatas = recommendationSnapshot.docs.map(doc => doc.data());
        const recRate = []
        recDatas.forEach(pl => recRate[pl.recommendationId] = recRate[pl.recommendationId] + 1 || 1);

        for(const key in recRate)
        {
            let [recommendation, recommendationRef] = await getRecommendationInfo(key);
            recommendation.rate = recRate[key];
            functions.logger.info(util.inspect(recommendation, {showHidden: false, depth: null}));

            // @ts-ignore
            await recommendationRef.set(recommendation, {merge: true, ignoreUndefinedProperties: true});

            functions.logger.info(`product ${key} has favorite count ${recRate[key]}`);
        }
    }
    catch (e) {
        functions.logger.error(e.message);
    }

}

app.post("/recalculate", async (req: Express.Request, res: Express.Response) => {
    try
    {
        //TODO: update product counts
        await updateFollowCounts(req, res);
        await updateProductCounts();
        await updatePostCounts();
        await updateRecommendationCounts();
        res.status(200).send("OK");

    } catch (e) {
        functions.logger.error(e.message);
        res.status(500).send(e.message);
    }

})

app.post("/recalculateUser", async (req: Express.Request, res: Express.Response) => {
    try
    {
        let [user, userRef] = await getUserInfo(req.body.userId);
        await updateUserCounters(db, user, userRef);
        res.status(200).send("OK");

    } catch (e) {
        functions.logger.error(e.message);
        res.status(500).send(e.message);
    }
})

app.post("/recalculateProduct", async (req: Express.Request, res: Express.Response) => {
    try
    {
        let [product, productRef] = await getProductInfo(req.body.externalId);
        await updateProductCounters(db, product, productRef);
        res.status(200).send("OK");

    } catch (e) {
        functions.logger.error(e.message);
        res.status(500).send(e.message);
    }
})


app.get("/brands", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await db.collection('brands').get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(500).send("There aren't any brands or collection hasn't been created yet.")
        return;
    }
    const brands = snapshot.docs.map(doc => doc.data().brand);

    if(!brands || brands.length == 0)
    {
        res.status(404).send("Could not find any brands");
        return;
    }

    res.status(200).send(Array.from(new Set(brands)));

})

Shopify.Context.initialize({
    API_KEY: "2271ad9473b2ee1d36b26a7a950d59c0", //API_KEY
    API_SECRET_KEY: "1b24986f532d52dc979b7d20e3ced8bf", // SECRET
    SCOPES: ["read_products"],
    HOST_NAME: "us-central1-social-ocean-6d649.cloudfunctions.net/appv2/importShopifyProducts",
    IS_EMBEDDED_APP: false,
    API_VERSION: ApiVersion.October21// all supported versions are available, as well as "unstable" and "unversioned"
});

// Shopify.Context.initialize({
//     API_KEY: "2271ad9473b2ee1d36b26a7a950d59c0", //API_KEY
//     API_SECRET_KEY: "1b24986f532d52dc979b7d20e3ced8bf", // SECRET
//     SCOPES: ["read_products"],
//     HOST_NAME: "e5a4-78-83-121-5.ngrok.io/importShopifyProducts",
//     IS_EMBEDDED_APP: false,
//     API_VERSION: ApiVersion.October21// all supported versions are available, as well as "unstable" and "unversioned"
// });

app.get('/importShopifyProducts', async (req, res) => {
    let authRoute = await Shopify.Auth.beginAuth(
        req,
        res,
        req.query.shop as string,
        '/auth/callback',
        false,
    );

    res.redirect(authRoute);
    return
});

app.get('/importShopifyProducts/auth/callback', async (req, res) => {
    try {
        const session = await Shopify.Auth.validateAuthCallback(
            req,
            res,
            req.query as unknown as AuthQuery,
        ); // req.query must be cast to unkown and then AuthQuery in order to be accepted
        functions.logger.log(session);
        console.log(session);


        const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
        // Use `client.get` to request the specified Shopify REST API endpoint, in this case `products`.
        const response = await client.get({
            path: 'products',
        });

        functions.logger.log((response.body as any).products);
        console.log((response.body as any).products);
        const productsRaw = (response.body as any).products;
        await Promise.all(productsRaw.map(async (product) => {
            functions.logger.log(product);
            console.log(product);
            const docRef = db.collection('products').doc();
            const productData = {
                boughtCount: 0,
                postCount: 0,
                recommendationCount: 0,
                totalPostLikes: 0,
                totalRecommendationLikes: 0,

                favoriteCount: 0,
                saveCount: 0,

                dateAdded: admin.firestore.FieldValue.serverTimestamp(),
                dateUpdated: admin.firestore.FieldValue.serverTimestamp(),
                brand: product.vendor || "",
                category: product.product_type || "",
                details: product.description || "",
                domain: product.url || "",
                externalId: docRef.id,
                hero: "",
                isActive: false,
                isCatchofTheDay: false,
                isHighlighted: false,
                isPopularUS: false,
                link: product.url || "",
                localPath: product.image.src || "",
                remotePath: product.image.src || "",
                shipping: "",
                subtitle: "",
                title: product.title || ""
            }

            await docRef.set(productData, {merge: true});
        }));
        res.status(200).send("OK");
    } catch (error) {
        console.error(error); // in practice these should be handled more gracefully
        res.status(500).send();
    }
});

exports.appv2 = functions
    .runWith({
        memory: '8GB',
        timeoutSeconds: 540
    }).https.onRequest(app);
