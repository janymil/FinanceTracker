import { describe, expect, it } from 'vitest';
import { invitationNotice } from '../../server/emailService';

/**
 * The notice inside a goal invitation.
 *
 * An invitation goes to an address another customer typed. Until this existed the e-mail was
 * pure marketing to a stranger: no explanation of where the address came from, no link to the
 * policy, no way to stop it. The assertions below are the three things that make it a notice
 * rather than an advert, and they must hold in the text body as well as in the HTML.
 */
describe('invitation notice', () => {
  const { text, html } = invitationNotice('Olga');

  it('says where the address came from', () => {
    expect(text).toContain('How we got your email address');
    expect(html).toContain('How we got your email address');
    expect(text).toContain('Olga');
  });

  it('links to the privacy policy in both bodies', () => {
    expect(text).toMatch(/https?:\/\/\S+\/en\/privacy/);
    expect(html).toMatch(/href="https?:\/\/[^"]+\/en\/privacy"/);
  });

  it('gives the recipient a way to stop the invitations', () => {
    for (const body of [text, html]) {
      expect(body).toContain('info@kaptia.app');
      expect(body).toContain('stop sending them');
    }
  });

  it('promises only what it can keep: no account, no list, one e-mail', () => {
    expect(text).toContain('have not created an account');
    expect(text).toContain('have not added you to any list');
    expect(text).toContain('This invitation sends one email');
  });

  it('escapes the inviter name, which is user input', () => {
    const injected = invitationNotice('<a href="https://evil.example">Verify your password</a>');
    expect(injected.html).not.toContain('<a href="https://evil.example">');
    expect(injected.html).toContain('&lt;a href=');
  });
});
