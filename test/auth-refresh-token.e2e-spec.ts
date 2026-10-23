/**
 * End-to-end: login and refresh-token rotation against a real (in-memory)
 * MongoDB, checking that refresh tokens are only ever stored hashed.
 *
 * Runs on the disposable database from `setup/mongo-global-setup.ts`; it
 * creates its own users and never touches the database in `.env`.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { ThrottlerStorage } from '@nestjs/throttler';
import { I18nService, I18nValidationPipe } from 'nestjs-i18n';
import { randomUUID } from 'crypto';
import cookieParser from 'cookie-parser';
import { Model, Types } from 'mongoose';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';
import { User } from '../src/auth/shared/schema/user.schema';
import { RefreshToken } from '../src/auth/shared/schema/refresh-token.schema';
import { Role } from '../src/roles/shared/schemas/role.schema';
import { hashRefreshToken } from '../src/auth/shared/utils/refresh-token-hash.util';
import { DeviceTokensService } from '../src/notifications/push/device-tokens.service';
import {
  DevicePlatform,
  DeviceToken,
} from '../src/notifications/push/schemas/device-token.schema';

const PASSWORD = 'E2e-Passw0rd!';
const LOGIN = '/api/v1/auth/login';
const REFRESH = '/api/v1/auth/refresh-token';
const LOGOUT = '/api/v1/auth/logout';
const MOBILE = { 'x-client-type': 'mobile' };

describe('Refresh tokens (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<User>;
  let refreshTokenModel: Model<RefreshToken>;
  let deviceTokenModel: Model<DeviceToken>;
  let userRoleId: unknown;

  const http = () => request(app.getHttpServer());
  const data = (res: Response) =>
    (res.body as { data: Record<string, unknown> }).data;

  /** Creates a fresh active user (the schema hook hashes the password). */
  const createUser = async () => {
    const email = `e2e-${randomUUID()}@example.com`;
    const user = await userModel.create({
      name: 'E2E User',
      email,
      password: PASSWORD,
      role: userRoleId,
      isActive: true,
    });
    // A string id, as the app passes it (JWT `user_id`).
    return { email, id: user._id.toString() };
  };

  /** Logs in as a mobile client, which gets the refresh token in the body. */
  const mobileLogin = async (email: string) => {
    const res = await http()
      .post(LOGIN)
      .set(MOBILE)
      .send({ email, password: PASSWORD })
      .expect(201);
    return data(res).refresh_token as string;
  };

  /**
   * A token as stored before hashing and the ObjectId schema fix: plaintext
   * token and string userId. Inserted through the driver so Mongoose does
   * not cast the userId.
   */
  const insertLegacyToken = (id: string, token: string, sessionId: string) =>
    refreshTokenModel.collection.insertOne({
      refresh_Token: token,
      userId: id,
      sessionId,
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

  /** The `refresh_token` cookie value from a response's Set-Cookie header. */
  const refreshCookieOf = (res: Response) => {
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const cookie = cookies.find((c) => c.startsWith('refresh_token='));
    return cookie?.split(';')[0].slice('refresh_token='.length);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // The suite logs in more often than the login rate limit allows.
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: () =>
          Promise.resolve({
            totalHits: 1,
            timeToExpire: 0,
            isBlocked: false,
            timeToBlockExpire: 0,
          }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // Same request pipeline as main.ts.
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new I18nValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(app.get(I18nService)));
    await app.init();

    userModel = app.get(getModelToken(User.name));
    refreshTokenModel = app.get(getModelToken(RefreshToken.name));
    deviceTokenModel = app.get(getModelToken(DeviceToken.name), {
      strict: false,
    });
    const roleModel = app.get<Model<Role>>(getModelToken(Role.name));
    // Seeded by RolesSeederService during app.init().
    userRoleId = (await roleModel.findOne({ name: 'User' }).lean())?._id;
    expect(userRoleId).toBeDefined();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('stores only the hash of a newly issued refresh token', async () => {
    const { email, id } = await createUser();
    const token = await mobileLogin(email);

    const docs = await refreshTokenModel.find({ userId: id }).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].refresh_Token).toBe(hashRefreshToken(token));
    expect(docs[0].refresh_Token).not.toBe(token);
  });

  it('rotates a token sent in the body and stores the new one hashed', async () => {
    const { email, id } = await createUser();
    const oldToken = await mobileLogin(email);

    const res = await http()
      .post(REFRESH)
      .send({ refresh_token: oldToken })
      .expect(201);
    const newToken = data(res).refresh_token as string;

    expect(newToken).toEqual(expect.any(String));
    expect(newToken).not.toBe(oldToken);
    expect(data(res).access_token).toEqual(expect.any(String));
    const stored = await refreshTokenModel.find({ userId: id }).lean();
    expect(stored.map((d) => d.refresh_Token)).toEqual([
      hashRefreshToken(newToken),
    ]);
  });

  it('rotates the refresh_token cookie for browsers', async () => {
    const { email, id } = await createUser();
    const login = await http()
      .post(LOGIN)
      .send({ email, password: PASSWORD })
      .expect(201);
    const oldToken = refreshCookieOf(login);
    expect(oldToken).toBeDefined();

    const res = await http()
      .get(REFRESH)
      .set('Cookie', `refresh_token=${oldToken}`)
      .expect(200);
    const newToken = refreshCookieOf(res);

    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);
    const stored = await refreshTokenModel.find({ userId: id }).lean();
    expect(stored.map((d) => d.refresh_Token)).toEqual([
      hashRefreshToken(newToken!),
    ]);
  });

  it('rejects a refresh token that was already used', async () => {
    const { email } = await createUser();
    const token = await mobileLogin(email);
    await http().post(REFRESH).send({ refresh_token: token }).expect(201);

    await http().post(REFRESH).send({ refresh_token: token }).expect(401);
  });

  it('rejects the stored hash when presented as a token (leaked DB)', async () => {
    const { email, id } = await createUser();
    await mobileLogin(email);
    const [doc] = await refreshTokenModel.find({ userId: id }).lean();

    await http()
      .post(REFRESH)
      .send({ refresh_token: doc.refresh_Token })
      .expect(401);
    // The real session is untouched by the failed attempt.
    expect(await refreshTokenModel.countDocuments({ userId: id })).toBe(1);
  });

  it('still accepts a legacy plaintext token once and replaces it with a hash', async () => {
    const { id } = await createUser();
    const legacyToken = randomUUID();
    await insertLegacyToken(id, legacyToken, randomUUID());

    const res = await http()
      .post(REFRESH)
      .send({ refresh_token: legacyToken })
      .expect(201);
    const newToken = data(res).refresh_token as string;

    const stored = await refreshTokenModel.find({ userId: id }).lean();
    expect(stored.map((d) => d.refresh_Token)).toEqual([
      hashRefreshToken(newToken),
    ]);
    await http().post(REFRESH).send({ refresh_token: legacyToken }).expect(401);
  });

  describe('userId stored as ObjectId', () => {
    it('stores userId of new tokens as an ObjectId', async () => {
      const { email, id } = await createUser();
      await mobileLogin(email);

      const raw = await refreshTokenModel.collection.findOne({
        userId: new Types.ObjectId(id),
      });
      expect(raw?.userId).toBeInstanceOf(Types.ObjectId);
    });

    it('logout revokes the current session', async () => {
      const { email, id } = await createUser();
      const login = await http()
        .post(LOGIN)
        .set(MOBILE)
        .send({ email, password: PASSWORD })
        .expect(201);

      await http()
        .post(LOGOUT)
        .set('Authorization', `Bearer ${data(login).access_token as string}`)
        .expect(201);

      expect(await refreshTokenModel.countDocuments({ userId: id })).toBe(0);
    });

    it('push: keeps devices of live sessions, drops ended ones', async () => {
      const { email, id } = await createUser();
      await mobileLogin(email);
      const [current] = await refreshTokenModel.find({ userId: id }).lean();
      const device = (token: string, sessionId: string) => ({
        token,
        user: new Types.ObjectId(id),
        sessionId,
        platform: DevicePlatform.ANDROID,
        lang: 'ar',
      });
      await deviceTokenModel.create([
        device(`live-${id}`, current.sessionId!),
        device(`ended-${id}`, randomUUID()),
      ]);

      const active = await app.get(DeviceTokensService).activeDevices(id);

      expect(active.map((d) => d.token)).toEqual([`live-${id}`]);
      expect(
        await deviceTokenModel.countDocuments({ token: `ended-${id}` }),
      ).toBe(0);
    });
  });
});
