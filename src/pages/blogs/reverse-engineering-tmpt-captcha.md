---
title: "Reverse Engineering TMPT Token Generation"
date: "2025-08-02"
description: "A comprehensive guide to reverse engineering the TMPT token generation process for Google reCAPTCHA v3 challenges."
author: "Marc"
tags: ["reverse-engineering", "captcha", "recaptcha", "tmpt", "security"]
layout: ../../layouts/BlogLayout.astro
---

## Initial Analysis

When we first encounter the TMPT challenge, we notice several key components that need to be considered:

1. **Client-side JavaScript validation**
2. **Server-side token verification**
4. **Behavioral pattern analysis**

These components work together to create a multi-layered security system that validates both the authenticity of the request and the behavioral patterns of the user.

## Network Traffic Analysis

Using Charles Proxy, we can analyze what's happening in the network traffic:

![Network traffic capture](/images/blog/tmpt-analysis/tmpt-network-traffic.png)

What's happening here is a GET request to the script `https://www.ticketmaster.com/eps-mgr`.

## EPS-MGR Script Analysis

This initial request is crucial as it establishes the foundation for the subsequent token generation process. The EPS-MGR script serves as the entry point for the TMPT token generation workflow.

This script is responsible for providing client data to the server, including the user's IP address among other information.

![EPS-MGR script response](/images/blog/tmpt-analysis/eps-mgr-script.png)

However, that's not what we need. What we need to extract from this script is the "epsfToken". For this, we can use a simple split and parsing operation. We'll call this token "gec_token".

```python
gec_token = response.text.split("epsfToken = '")[1].split("';")[0]
```

Finally, we need to obtain the cookie generated in this GET request to the EPS-MGR script called "eps_sid". This cookie will be fundamental for our "tmpt" token to work properly.

```python
eps_sid = response.cookies.get("eps_sid", None)
```

The `eps_sid` cookie acts as a session identifier that links our subsequent requests to the initial EPS-MGR interaction, ensuring continuity in the token generation process.

## Structuring the Endpoint for the POST Request

As we can see in the network traffic analysis, where the token we're looking for is generated is in this POST request:

![POST request showing TMPT token generation](/images/blog/tmpt-analysis/tmpt-post-request.png)

To replicate this endpoint, we'll do it as follows:

```python
token_url = f"https://{hostname}/epsf/gec/v3/{gec_token}/{action}"
```

Let's go step by step:

- **hostname**: This is the origin from where we want to generate the tmpt (and where we would have previously generated the reCAPTCHA v3), for example: `www.ticketmaster.com`
- **gec_token**: This is the token we extracted in the previous step
- **action**: For different endpoints where we want to point, there are different actions. For example, for the `/event/` page, there's the "Event" action, for the main page, there's the "pageView" action. (You can extract this parameter from devtools by making a GET request to your target)

Once structured, our token_url should look something like this:

```python
"""
https://www.ticketmaster.com/epsf/gec/v3/1754132342_0x52dcaaeb833ab8b95aef36f47671a2a2cd39e686/Event
"""
```

The action parameter is context-specific and depends on the particular page or functionality you're targeting. Different pages require different action identifiers to generate valid TMPT tokens.

## Making the POST Request

For the final request to the server side, we need to consider several things for our "tmpt" token to be valid, such as the headers.

Make sure your headers are ordered in the same way the browser does. Some very important headers are:

```python
headers = {
    "Host": "www.example.com",
    "user-agent": "Mozilla/5.0 (Windows; Windows NT 10.1;) AppleWebKit/603.23 (KHTML, like Gecko) Chrome/52.0.1232.353 Safari/600.1 Edge/10.27210",
    'content-type': 'application/json',
    'access-control-allow-credentials': 'true',
    "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    'origin': 'https://www.example.com',
}
```

We also need to correctly structure the JSON that we'll send in this request:

```python
json_data = {
    'hostname': 'www.example.com',
    'key': '# THE GOOGLE RECAPTCHA KEY OF THE SPECIFIC SITE',
    'token': '# YOUR RECAPTCHA V3 TOKEN',
}
```

Finally, the only cookie we should pass to this request will be "eps_sid", obtained in the first step:

```python
cookies={"eps_sid": eps_sid}
```

With this, we would have our structure ready to make the POST request. Make sure to have redirection enabled in the request.

## Extracting the TMPT Token

The "tmpt" token will be found in the cookies of the response from this request:

```python
tmpt_token = response.cookies.get("tmpt", None)
```

Once you have successfully extracted the TMPT token, it can be used in subsequent requests to bypass the TMPT challenge. The token typically has a limited lifespan and is tied to the specific session and behavioral patterns established during the generation process.

## Complete Implementation Example

Here's a complete Python implementation that combines all the steps:

```python
import requests
import re

def generate_tmpt_token(hostname, recaptcha_key, recaptcha_token, action="pageView"):
    """
    Generate TMPT token for a given hostname and reCAPTCHA token
    """
    session = requests.Session()
    
    # Step 1: Get EPS-MGR script and extract gec_token
    eps_mgr_url = f"https://{hostname}/eps-mgr"
    response = session.get(eps_mgr_url)
    
    if "epsfToken" not in response.text:
        raise Exception("Could not find epsfToken in EPS-MGR response")
    
    gec_token = response.text.split("epsfToken = '")[1].split("';")[0]
    eps_sid = response.cookies.get("eps_sid")
    
    if not eps_sid:
        raise Exception("Could not obtain eps_sid cookie")
    
    # Step 2: Structure the token generation endpoint
    token_url = f"https://{hostname}/epsf/gec/v3/{gec_token}/{action}"
    
    # Step 3: Prepare headers and payload
    headers = {
        "Host": hostname,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        'content-type': 'application/json',
        'access-control-allow-credentials': 'true',
        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        'origin': f'https://{hostname}',
    }
    
    json_data = {
        'hostname': hostname,
        'key': recaptcha_key,
        'token': recaptcha_token,
    }
    
    cookies = {"eps_sid": eps_sid}
    
    # Step 4: Make the POST request
    response = session.post(
        token_url,
        headers=headers,
        json=json_data,
        cookies=cookies,
        allow_redirects=True
    )
    
    # Step 5: Extract TMPT token
    tmpt_token = response.cookies.get("tmpt")
    
    if not tmpt_token:
        raise Exception("Could not obtain TMPT token")
    
    return tmpt_token

# Usage example
if __name__ == "__main__":
    hostname = "www.ticketmaster.com"
    recaptcha_key = "6LfYourSiteKeyHere"
    recaptcha_token = "your_recaptcha_v3_token_here"
    
    try:
        tmpt = generate_tmpt_token(hostname, recaptcha_key, recaptcha_token, "Event")
        print(f"Successfully generated TMPT token: {tmpt}")
    except Exception as e:
        print(f"Error generating TMPT token: {e}")
```

Please note that this script is not finished and is simply a representation of the explanation in this article.

## Contact

If you have any questions about this article, you can contact me through hey@marcsnv.com

---

## Disclaimer

*This package is unofficial and not affiliated with Amazon or AWS. Use it responsibly and in accordance with Ticketmaster's terms of service.*
