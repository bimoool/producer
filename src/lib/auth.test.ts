import { describe, expect, it } from "vitest";
import { checkBasicAuth } from "./auth";

const creds = { user: "me", password: "long-password" };
const hdr = (s: string) => "Basic " + btoa(s);

describe("checkBasicAuth", () => {
  it("пускает с верными данными", () => expect(checkBasicAuth(hdr("me:long-password"), creds)).toBe("ok"));
  it("отказывает с неверным паролем", () => expect(checkBasicAuth(hdr("me:wrong-password"), creds)).toBe("denied"));
  it("отказывает без заголовка", () => expect(checkBasicAuth(null, creds)).toBe("denied"));
  it("закрыто, если не настроено", () => {
    expect(checkBasicAuth(hdr("me:x"), {})).toBe("misconfigured");
    expect(checkBasicAuth(hdr("me:short"), { user: "me", password: "short" })).toBe("misconfigured");
  });
});
