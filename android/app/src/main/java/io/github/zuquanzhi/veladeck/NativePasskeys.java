package io.github.zuquanzhi.veladeck;

import android.app.Activity;
import androidx.credentials.*;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.GetCredentialException;
import org.json.JSONObject;
import java.util.function.Consumer;

/** The platform Credential Manager supplies Android's verified app origin. */
final class NativePasskeys {
    static void register(Activity activity, JSONObject options, Consumer<JSONObject> done, Runnable failed) {
        CredentialManager manager = CredentialManager.create(activity);
        manager.createCredentialAsync(activity, new CreatePublicKeyCredentialRequest(options.toString()), null, androidx.core.content.ContextCompat.getMainExecutor(activity),
            new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                @Override public void onResult(CreateCredentialResponse response) {
                    try { if (!(response instanceof CreatePublicKeyCredentialResponse)) { failed.run(); return; } done.accept(new JSONObject(((CreatePublicKeyCredentialResponse) response).getRegistrationResponseJson())); }
                    catch (Exception error) { failed.run(); }
                }
                @Override public void onError(CreateCredentialException error) { failed.run(); }
            });
    }
    static void authenticate(Activity activity, JSONObject options, Consumer<JSONObject> done, Runnable failed) {
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(new GetPublicKeyCredentialOption(options.toString())).build();
        CredentialManager.create(activity).getCredentialAsync(activity, request, null, androidx.core.content.ContextCompat.getMainExecutor(activity),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override public void onResult(GetCredentialResponse response) {
                    try { if (!(response.getCredential() instanceof PublicKeyCredential)) { failed.run(); return; } done.accept(new JSONObject(((PublicKeyCredential) response.getCredential()).getAuthenticationResponseJson())); }
                    catch (Exception error) { failed.run(); }
                }
                @Override public void onError(GetCredentialException error) { failed.run(); }
            });
    }
}
