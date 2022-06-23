import Express from 'express';
import cors from 'cors';
import * as functions from "firebase-functions";
import admin from 'firebase-admin';

import Shopify, {
    ApiVersion,
    AuthQuery
} from '@shopify/shopify-api';

import { initializeApp, cert } from 'firebase-admin/app';

import * as serviceAccount from '../firebase-service-account.json';

const firebaseServiceAccount = {               //clone json object into new object to make typescript happy
    type: serviceAccount.type,
    projectId: serviceAccount.project_id,
    privateKeyId: serviceAccount.private_key_id,
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
    clientId: serviceAccount.client_id,
    authUri: serviceAccount.auth_uri,
    tokenUri: serviceAccount.token_uri,
    authProviderX509CertUrl: serviceAccount.auth_provider_x509_cert_url,
    clientC509CertUrl: serviceAccount.client_x509_cert_url
}

// initializeApp({
//     credential: cert(firebaseServiceAccount)
// });

const  db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

import express from 'express';

let app: Express.Application = Express();
// app.use(Express.urlencoded({ extended: false }));
const options: cors.CorsOptions = {
    origin: "*",
};
app.use(cors(options));
app.use(express.json());

Shopify.Context.initialize({
    API_KEY: "2271ad9473b2ee1d36b26a7a950d59c0", //API_KEY
    API_SECRET_KEY: "1b24986f532d52dc979b7d20e3ced8bf", // SECRET
    SCOPES: ["read_products"],
    HOST_NAME: "us-central1-social-ocean-6d649.cloudfunctions.net/importShopifyProducts",
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

exports.shopify = functions
    .runWith({
        memory: '8GB',
        timeoutSeconds: 540
    }).https.onRequest(app);
